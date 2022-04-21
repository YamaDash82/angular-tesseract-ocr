# angular-tesseract-ocr
AngularフレームワークとTesseract.jsライブラリを用いてOCRを実装

## 概要
スマホもしくはタブレットのOCRをAngularとTesseract.jsを用いて実装しました。

当リポジトリのAngularプロジェクトフォルダをPCに展開し、Angularローカルサーバを立ち上げます。

PCと同じwifiに接続しているスマホ/タブレットから、`https://(PC名もしくはPCのipアドレス):4200`に接続してください。

スマホ、タブレットのカメラを用いたOCRを確認できます。

![sample](https://user-images.githubusercontent.com/36125871/164358020-35f2a80c-c1b8-453c-8589-b1a040e178a9.gif)

## 主要フレームワーク、ライブラリ
- Angular
- Tesseract.js

## 環境構築手順
### 1. Dockerコンテナの作成
Dockerコンテナを作成せず、ホストPCに直接環境を構築する場合は、この手順はスキップしてください。

Dockerfileをもとにイメージを作成します。
```powershell
docker build -t angular-tesseract-ocr:1 .
```

コンテナを作成します。
```powershell
docker run --name angular-tesseract-ocr -p 4200:4200 -it angular-tesseract-ocr:1 /bin/bash
```

### 2. 依存ライブラリのインストール


```powershell
npm install
```


### 3. Angularのテストサーバを起動


```powershell
npm run serve-ssl
```
**重要**
ブラウザにてスマホ/タブレットのカメラモジュールを使用するため、httpsのテストサーバを起動します。
Angularにてよく用いる`ng serve`コマンドではなく、上記のコマンドを用いてください。また、下記**注意**の節をご確認ください。


## 注意
Angularのテストサーバをhttpsで起動させるため、テスト用に作成した秘密鍵`./dist/ssl/server.key`、サーバ証明書`./dist/ssl/server.crt`を使用しています。
`package.json`にhttpsでのAngularテストサーバ起動用の`serve-ssl`スクリプトを宣言しています。
```powershell
# angularプロジェクトフォルダに移動
cd ocr-test

# httpsでangularテストサーバを起動する。
npm run serve-ssl
```

`serve-ssl`スクリプトの定義部分です。
```json:package.json
  "scripts": {
    ...
    "serve-ssl": "ng serve --host=0.0.0.0 --poll=2000 --ssl true --ssl-key ../dist/ssl/server.key --ssl-cert ../dist/ssl/server.crt",
    ...
  },
```

## ライセンス
フリーライセンスです。


以上です。
