# SL: キータイプ矯正ソフト

むかしにも投稿された冗談ソフトの sl の豪華版です。アイデアは借り物ですが、プログラム自体は私のオリジナルです。いまさらながら若干アップデートしました。a,l,F,c オプションが有効です。機能は実行して確かめてください。

Copyright 1993,1998,2014 Toyoda Masashi (mtoyoda@acm.org)

## 開発

Web サイトをビルドする前に、JavaScript の依存関係と WebAssembly のビルドツールをセットアップしてください。

```sh
bun install
bun run setup
```

`bun run setup` は、Web サイトのビルドに必要な Rust の `wasm32-unknown-unknown` ターゲットと `wasm-pack`
をインストールします。ビルドや開発用スクリプトは、これらが足りない場合にセットアップコマンドを表示します。
