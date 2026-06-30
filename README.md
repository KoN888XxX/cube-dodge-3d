# Cube Dodge 3D

青いキューブを操作して、赤い障害物キューブを避け続ける3Dミニゲームです。

## 主な機能

- Three.jsによる3D表示
- WASD / 矢印キーで移動
- Spaceキーでジャンプ
- スコア表示
- ハイスコア保存
- 時間経過による障害物の速度上昇
- スコアに応じた障害物数の増加
- Game Over表示とRキーリスタート
- Web Audio APIによる効果音

## 操作方法

- Enter または Space: ゲーム開始
- WASD / 矢印キー: 移動
- Space: ジャンプ
- R: リスタート

## 開発環境

- Vite
- TypeScript
- Three.js

## ローカル起動方法

```bash
npm install
npm run dev
```

## ビルド方法

```bash
npm run build
```

## 注意

- 現時点ではローカル開発用のプロジェクトです。
- ハイスコアはブラウザのlocalStorageに保存されます。
- サーバーや外部DBは使っていません。
