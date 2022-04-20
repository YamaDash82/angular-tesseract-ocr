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
        <div class="camera-parent1">
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
              [style.height.px]="vSliderSetting.height"
              [max]="vSliderSetting.max"
              [(ngModel)]="vSliderValue"
              (valueChange)="setCaptureSize(vSliderValue, hSliderValue)"
            ></mat-slider>
          </div>
        </div>
        <div>
          <mat-slider 
            #videoHSlider
            class="h-slider"
            [style.width.px]="hSliderSeting.width"
            [max]="hSliderSeting.max"
            [(ngModel)]="hSliderValue"
            (valueChange)="setCaptureSize(vSliderValue, hSliderValue)"
          ></mat-slider>
        </div>
      </div>
    </div>
    
    <canvas
      #captured
      class="captured"
    >
    </canvas>
    <button 
      (click)="recognize()" 
      mat-raised-button 
      class="ocr-button"
      color="primary"
    >読込</button>
  `,
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit, AfterViewChecked, AfterViewInit {
  @ViewChild('targetVideo') videoVc !: ElementRef;
  videoEmt!: HTMLVideoElement;

  @ViewChild('previewCanvas') previewCanvasVc !: ElementRef;
  previewEmt!: HTMLCanvasElement;
  previewCvsCtx!: CanvasRenderingContext2D | null;
  
  @ViewChild('captured') capturedVc !: ElementRef;
  capturedEmt!: HTMLCanvasElement;

  videoSize = { height: 0, width: 0 };
  videoSizeChanged = new Subject<{height: number, width: number}>();
  videoSizeChanged$ = this.videoSizeChanged.asObservable();

  vSliderValue = 0;
  vSliderSetting = {
    height: 0,
    max: 0
  }
  
  hSliderValue = 0;
  hSliderSeting = {
    width: 0, 
    max: 0
  }
  
  
  //タブレット時のOCR切り取りサイズ 
  //captureSize =  { width: 384, height: 192 };
  //スマホ時のOCR切り取りサイズ
  captureSize =  { width: 192, height: 96 };

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
      //プレビュー画像のサイズ
      const previewWidth = Math.floor(size.width * 2 / 3);
      const previewHeight = Math.floor(size.height * 2 / 3);
      
      //プレビュー画像のサイズを設定
      this.previewEmt.width = previewWidth;
      this.previewEmt.height = previewHeight;    
      
      //縦スライダーの最大値を設定
      this.vSliderSetting = {
        height: previewHeight, 
        max: previewHeight
      }; 
      
      this.hSliderSeting = {
        width: previewWidth, 
        max: previewWidth 
      };

      this.vSliderValue = Math.floor(this.vSliderSetting.height / 2);
      this.hSliderValue = Math.floor(this.hSliderSeting.width * 2 / 3);

      //キャプチャサイズ設定処理を行う。
      this.setCaptureSize(this.vSliderValue, this.hSliderValue);
    });

    this.takeVideo();
  }

  async ngAfterViewInit(): Promise<void> {
    this.videoEmt = this.videoVc.nativeElement;    
    
    this.previewEmt = this.previewCanvasVc.nativeElement;
    this.previewCvsCtx = this.previewEmt.getContext('2d');
    
    this.capturedEmt = this.capturedVc.nativeElement;
    
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
    //videoのサイズ変更の有無をチェックする。
    if (
      this.videoSize.width !== this.videoEmt.videoWidth
      || this.videoSize.height !== this.videoEmt.videoHeight
    ) {
      //サイズをキャッシュする。
      this.videoSize.height = this.videoEmt.videoHeight;
      this.videoSize.width = this.videoEmt.videoWidth;

      //サイズ変更時のイベントを発火する。(ストリームに流す。)
      //サイズ変更時の処理はngOnInitで定義している。
      this.videoSizeChanged.next({
        height: this.videoEmt.videoHeight, 
        width: this.videoEmt.videoWidth
      });
    }
  }

  //キャプチャサイズ変更処理
  setCaptureSize(height: number, width: number){
    //取り込む画像サイズ
    this.captureSize.height = height;
    this.captureSize.width = width;

    //取り込む際に使用するキャンバスのサイズ
    this.capturedEmt.width = this.captureSize.width;
    this.capturedEmt.height = this.captureSize.height;
    
    //baseWidth、baseHeightはプレビューを表示するcanvasのサイズ。
    const baseWidth = this.previewEmt.width;
    const baseHeight = this.previewEmt.height;
    
    //カメラ映像から切り取る部分の座標を取得する。
    //左上
    this.rectPoints[0].x = Math.floor((baseWidth - this.captureSize.width) / 2);
    this.rectPoints[0].y = Math.floor((baseHeight - this.captureSize.height) / 2);

    //右上
    this.rectPoints[1].x = Math.floor(baseWidth / 2) + Math.floor(this.captureSize.width / 2);
    this.rectPoints[1].y = this.rectPoints[0].y;
    
    //右下
    this.rectPoints[2].x = this.rectPoints[1].x;
    this.rectPoints[2].y =  Math.floor(baseHeight / 2) + Math.floor(this.captureSize.height / 2);
    
    //左下
    this.rectPoints[3].x = this.rectPoints[0].x;
    this.rectPoints[3].y = this.rectPoints[2].y;

    this.takeVideo();
  }

  async takeVideo() {
    //setIntervalが継続している場合、止める。
    if(this.intervalId) {
      clearInterval(this.intervalId);
    }

    try {
      this.intervalId = setInterval(() => {
        this.videoEmt.play();
        
        this.previewCvsCtx?.drawImage(this.videoEmt, 0, 0, this.previewEmt.width, this.previewEmt.height);
        
        //video再生画像中に、OCRで取り込む範囲の線を描画する。
        if(this.previewCvsCtx) {
          
          this.previewCvsCtx.beginPath();
          
          this.previewCvsCtx.moveTo(this.rectPoints[0].x, this.rectPoints[0].y);
          this.previewCvsCtx.lineTo(this.rectPoints[1].x, this.rectPoints[1].y);
          this.previewCvsCtx.lineTo(this.rectPoints[2].x, this.rectPoints[2].y);
          this.previewCvsCtx.lineTo(this.rectPoints[3].x, this.rectPoints[3].y);
          this.previewCvsCtx.closePath();
          
          this.previewCvsCtx.strokeStyle = "gray";
          this.previewCvsCtx.lineWidth = 5;
  
          this.previewCvsCtx.stroke();
        }
        
      }, 200);
    } catch(err) {
      setTimeout(() => {
        alert('エラー');
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

    capCtx?.drawImage(this.previewEmt, 
      this.rectPoints[0].x, 
      this.rectPoints[0].y, 
      this.captureSize.width, 
      this.captureSize.height, 
      0, 0, 
      this.captureSize.width, 
      this.captureSize.height
    );

    //読み込む画像を取得する。
    const image = this.capturedEmt.toDataURL();

    //ocr実行
    try {
      const worker = Tesseract.createWorker();
      await worker.load();
      //複数言語連ねるときは+で連結する。
      //https://github.com/naptha/tesseract.js/blob/master/docs/api.md#worker-load-language
      await worker.loadLanguage('eng');
      //
      await worker.initialize('eng');

      
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
