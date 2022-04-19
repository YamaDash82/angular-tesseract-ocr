import { Component, ElementRef, OnInit, ViewChild, AfterViewInit, AfterViewChecked } from '@angular/core';
import { MatSlider } from '@angular/material/slider';
import * as Tesseract from 'tesseract.js';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-root',
  template: `
    <p>AngularでOCR</p>
    <p>{{consoleText}}</p>
    <video 
      #targetVideo 
      playsinline 
      class="reader-video"
      hidden
    >Video Camera Area</video>
    <div class="camera-parent">
      <div class="camera-parent2">
        <canvas
          #previewCanvas
          class="video-preview"
        >
        </canvas>
        <div>
          <mat-slider 
            vertical="true" 
            #videoVSlider
            class="v-slider"
          ></mat-slider>
        </div>
        
      </div>
      <div>
        <mat-slider 
          #videoHSlider
          class="h-slider"
        ></mat-slider>
      </div>
      
    </div>
    
    
    
    <canvas
      #captured
    >
    </canvas>
    <button (click)="recognize()" class="ocr-button">読込</button>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewChecked, AfterViewInit {
  @ViewChild('targetVideo') videoVc !: ElementRef;
  videoEmt!: HTMLVideoElement;

  @ViewChild('previewCanvas') canvasVc !: ElementRef;
  canvasEmt!: HTMLCanvasElement;
  canvasCtx!: CanvasRenderingContext2D | null;
  
  @ViewChild('captured') capturedVc !: ElementRef;
  capturedEmt!: HTMLCanvasElement;

  @ViewChild('videoVSlider') videoVSliderVc !: ElementRef;
  videoVSliderEmt!: any;

  @ViewChild('videoHSlider') videoHSliderVc !: ElementRef;
  videoHSliderEmt!: any;
  
  videoSize = { height: 0, width: 0 };
  videoSizeChanged = new Subject<{height: number, width: number}>();
  videoSizeChanged$ = this.videoSizeChanged.asObservable();

  //タブレット時のOCR切り取りサイズ 
  //targetSize =  { width: 384, height: 192 };
  //スマホ時のOCR切り取りサイズ
  targetSize =  { width: 192, height: 96 };

  rectPoints: { x: number, y:number }[] = [
    {x: 0, y:0}, 
    {x: 0, y:0}, 
    {x: 0, y:0}, 
    {x: 0, y:0}
  ];

  consoleText = "";

  private intervalId!: NodeJS.Timeout;

  constructor() {

  }

  ngOnInit(): void {
    //videoのサイズ変更時(スマホ/タブレットの縦横が変わった時を想定)
    this.videoSizeChanged$.subscribe(size => {
      const settingVideoWidth = Math.floor(this.videoEmt.videoWidth / 2);
      const settingVideoHeight = Math.floor(this.videoEmt.videoHeight / 2);
      if(this.canvasEmt.width !== settingVideoWidth || this.canvasEmt.height !== settingVideoHeight) {
        this.canvasEmt.width = settingVideoWidth ;
        this.canvasEmt.height = settingVideoHeight;    
        
        const baseWidth = settingVideoWidth;
        const baseHeight = settingVideoHeight;
        
        //カメラ映像から切り取る部分の座標を取得する。
        //左上
        this.rectPoints[0].x = Math.floor((baseWidth - this.targetSize.width) / 2);
        this.rectPoints[0].y = Math.floor((baseHeight - this.targetSize.height) / 2);

        //右上
        this.rectPoints[1].x = Math.floor(baseWidth / 2) + Math.floor(this.targetSize.width / 2);
        this.rectPoints[1].y = this.rectPoints[0].y;
        
        //右下
        this.rectPoints[2].x = this.rectPoints[1].x;
        this.rectPoints[2].y =  Math.floor(baseHeight / 2) + Math.floor(this.targetSize.height / 2);
        
        //左下
        this.rectPoints[3].x = this.rectPoints[0].x;
        this.rectPoints[3].y = this.rectPoints[2].y;
      }
    });
  }

  async ngAfterViewInit(): Promise<void> {
    this.videoEmt = this.videoVc.nativeElement;    
    
    this.canvasEmt = this.canvasVc.nativeElement;
    this.canvasCtx = this.canvasEmt.getContext('2d');
    
    this.capturedEmt = this.capturedVc.nativeElement;
    this.capturedEmt.width = this.targetSize.width;
    this.capturedEmt.height = this.targetSize.height;
    
    this.videoVSliderEmt = this.videoVSliderVc.nativeElement;
    this.videoHSliderEmt = this.videoHSliderVc.nativeElement;
    
    await ((): Promise<void> => {
      return new Promise((resolve, reject) => {
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "environment"}
        }).then(stream => {
          this.videoEmt.srcObject = stream;
          this.videoEmt.setAttribute("playsinline", "true");
          return resolve();
        }).catch(err => {
          return reject(err);
        });
      })
    })();
  }
 

  async ngAfterViewChecked(): Promise<void> {
    if (
      this.videoSize.width !== this.videoEmt.videoWidth
      || this.videoSize.height !== this.videoEmt.videoHeight
    ) {
      alert(`video height:${this.videoEmt.videoHeight}, width:${this.videoEmt.videoWidth}`);
      this.videoSize.height = this.videoEmt.videoHeight;
      this.videoSize.width = this.videoEmt.videoWidth;

      this.videoSizeChanged.next({
        height: this.videoEmt.videoHeight, 
        width: this.videoEmt.videoWidth
      });
    }
    
    this.takeVideo();
  }

  async takeVideo() {
    try {
      this.intervalId = setInterval(() => {
        this.videoEmt.play();
        
        this.canvasCtx?.drawImage(this.videoEmt, 0, 0, this.canvasEmt.width, this.canvasEmt.height);
        
        //video再生画像中に、OCRで取り込む範囲の線を描画する。
        if(this.canvasCtx) {
          
          this.canvasCtx.beginPath();
          
          this.canvasCtx.moveTo(this.rectPoints[0].x, this.rectPoints[0].y);
          this.canvasCtx.lineTo(this.rectPoints[1].x, this.rectPoints[1].y);
          this.canvasCtx.lineTo(this.rectPoints[2].x, this.rectPoints[2].y);
          this.canvasCtx.lineTo(this.rectPoints[3].x, this.rectPoints[3].y);
          this.canvasCtx.closePath();
          
          this.canvasCtx.strokeStyle = "gray";
          this.canvasCtx.lineWidth = 5;
  
          this.canvasCtx.stroke();
        }
        
      }, 200);
    } catch(err) {
      setTimeout(() => {
        this.consoleText = err instanceof Error ? err.message : "takeVideoでエラー発生";
      });
    }
  }

  showProcessingMessage(): NodeJS.Timeout {
    let currentProcess = 0;
    const processingMessages = [
      '認識中', 
      '認識中.', 
      '認識中..', 
      '認識中...'
    ]
    return setInterval(
      () => {
        if(currentProcess === processingMessages.length) currentProcess = 0;
        this.consoleText = processingMessages[currentProcess++];
      }, 500
    );
  }

  async recognize() {
    //canvasへの描画が止まると思ったのだが止まらない。
    clearInterval(this.intervalId);
    this.videoEmt.pause();
    const intervalProcess = this.showProcessingMessage();

    //カメラ映像からOCRにかける領域を切り取る。
    const capCtx = this.capturedEmt.getContext('2d');

    capCtx?.drawImage(this.canvasEmt, 
      this.rectPoints[0].x, 
      this.rectPoints[0].y, 
      this.targetSize.width, 
      this.targetSize.height, 
      0, 0, 
      this.targetSize.width, 
      this.targetSize.height
    );

    //読み込む画像を取得する。
    const image = this.capturedEmt.toDataURL();

    //ocr実行
    try {
      const worker = Tesseract.createWorker();
      await worker.load();
      //複数言語連ねるときは+で連結する。
      //https://github.com/naptha/tesseract.js/blob/master/docs/api.md#worker-load-language
      await worker.loadLanguage('jpn');
      //
      await worker.initialize('jpn');

      
      const recongnized = await worker.recognize(image);
      await worker.terminate();

      
      alert(recongnized.data.text);
    } catch(err) {
      this.consoleText = err instanceof Error ? err.message : "認識処理中にエラーが発生しました。";
    }

    clearInterval(intervalProcess);
    this.consoleText = "";

    this.takeVideo();
  }
}
