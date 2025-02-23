//1. まずはexpressというnode.jsの機能を使えるよう読み込みましょう🤗
const express = require("express");

// 2. ここで実行をします🤗appの箱の中でexpressの機能が使えるようにしています🤗
const app = express();

// CORS対策 npm i corsをしてインストールしてから記述🤗
const cors = require("cors");





// prismaのclientの機能を使えるようにする🤗
const { PrismaClient } = require("@prisma/client");

// パスワードハッシュ化
const bcrypt = require("bcrypt");

// json web token jwtの機能を設定します
const jwt = require("jsonwebtoken");

// 環境変数=秘密の鍵が使えるようにdotenvを記述して使えるようにします🤗
require("dotenv");

// clientの機能を使えるように設定する
const prisma = new PrismaClient();


//3. PORT=どの番号で画面のURLを設定するかというものです🤗
// 例: 8888の場合は localhost:8888になります🤗
const PORT = 8888;

// 必ずexpress.json()の上で記述！そうしないとcorsが回避できません！！
app.use(cors());

// jsで書いた文字列をjsonとしてexpressで使えるようにする必要があります🤗
app.use(express.json());

// ミドルウェア=レストランの入り口 で 「予約がしてる？」の確認のようなイメージ🤗
// 予約（＝トークン）がある人 → 店内（＝APIの処理）に進める
// 予約がない人 → 入れない（エラーになる）
const authenticateToken = (req, res, next) => {
  console.log("Authorization ヘッダー:", req.headers.authorization);

  const token = req.headers.authorization?.split(" ")[1]; //予約（トークン）を取り出す
  console.log("抽出されたトークン:", token);

  if (!token) {
    // 予約（トークン）がない場合は入れない
    return res.status(401).json({ message: "認証トークンが必要です。" });
  }

  try {
    const decoded = jwt.verify(token, process.env.KEY); //予約（トークン）を確認
    console.log("デコード結果:", decoded);

    req.user = decoded; //OKならユーザー情報を設定🤗
    next(); // 店（APIの処理）に進める
  } catch (error) {
    console.log("JWT 検証エラー:", error);
    return res.status(403).json({ message: "無効なトークンです。" });
  }
};


// 5.簡単なAPIの挙動を確認、作成してみます！
// getはデータを表示するようなイメージです
app.get("/", (req, res) => {
  res.send("<h1>こんにちは</h1>");
});

// 6.新規ユーザー登録のAPIを作成します
app.post("/api/auth/register", async (req, res) => {

  // 送られるものを抜き出します。分割代入 es6のおまじないです
  const { username, email, password } = req.body

  // 暗号化対応=bcryptを使ってハッシュ化する🤗
  const hasedPass = await bcrypt.hash(password, 10);

  // ここがプリズマの文法になります [user]はモデルuserになります 
  const user = await prisma.user.create({
    data: {
      username,
      email,
      password: hasedPass,
    },
  });

  // prismaにデータを送ったあとにjsonでデータをもどします
  return res.json({ user });

  // 下は消さない
});

// 2025 2/16 7.ログインAPIの開発からスタートします
app.post("/api/auth/login", async (req, res) => {
  // email,passwordをチェックするために取得します
  const { email, password } = req.body;

  // whereはSQL等で出てくる条件を絞るおまじないです（正確にはSQL文です）
  const user = await prisma.user.findUnique({ where: { email } });

  // emailがあるかないかを先ほどuserのところの箱に収納したので、if文でチェックします
  if (!user) {
    return res.status(401).json({
      error: "そのユーザーは存在しません",
    });
  }

  // パスワードチェックの記述になります
  const isPasswordCheck = await bcrypt.compare(password, user.password);

  // パスワードがあるかないか、送られたものと保存されたものをチェックしてます
  if (!isPasswordCheck) {
    return res.status(401).json({
      error: "そのパスワードは間違ってます！",
    });
  }

  // email,パスワードをチェックし、無事見つけられたらチケット（token=乗車券）を発行します

  const token = jwt.sign({ id: user.id }, process.env.KEY, {
    expiresIn: "1d",
  });

  return res.json({ token });

})

// 投稿API authenticateTokenは次のページで記述しています🤗
app.post("/api/post", authenticateToken, async (req, res) => {
  console.log("現在のユーザー ID:", req.user.id);
  //userのidをチェックします🤗が流れとしては次のページを参考にしてください🤗

  const { content } = req.body;
  console.log(content, "content");
  // contentが空の時=文字が入力されていないのでここでエラーでDBにデータを送らないようにする🤗
  if (!content) {
    return res.status(400).json({ message: "投稿内容が入力されていません" });
  }

  try {
    // 成功した時にprismaを使用してデータを登録する🤗
    const post = await prisma.post.create({
      data: {
        content,
        authorId: req.user.id,
      },
      include: {
        //ここはポイントになります！
        author: true,
      },
    });
    res.status(201).json(post);
  } catch (err) {
    console.log(err, "エラー内容");
    res.status(500).json({ message: "サーバーエラーです。" });
  }

  // この下は消さない
});


// 投稿取得API🤗
app.get("/api/posts", async (req, res) => {
  try {
    // 成功した時にprismaを使用してデータを取得🤗
    const posts = await prisma.post.findMany({
      take: 10, //これで最新の10件を取得できる🤗超便利！,
      orderBy: { createdAt: "desc" }, //これで登録日から降順で取得(登録された最後のものから順番に取得)
      include: {
        //ここはポイントになります！
        author: true,
      },
    });
    res.status(201).json(posts);
  } catch (err) {
    console.log(err, "エラー内容");
    res.status(500).json({ message: "サーバーエラーです。" });
  }

  // この下は消さない
});

//4.サーバーを起動させましょう🤗イメージはスイッチONにして動かす🤗
app.listen(PORT, () => {
  console.log("server start!!!!!!");
});