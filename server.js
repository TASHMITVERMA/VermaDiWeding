const express = require("express");
const multer = require("multer");
const { google } = require("googleapis");
const cors = require("cors");
const fs = require("fs");

const app = express();
app.use(cors());

const upload = multer({ dest: "uploads/" });

const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_CREDENTIALS),
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

const FOLDER_ID = "1MALLfg_ONmkh37PwJSWZW5Vl6wsfCo9_";

app.post("/upload", upload.single("photo"), async (req, res) => {
  try {
    const fileMetadata = {
      name: req.file.originalname,
      parents: [FOLDER_ID],
    };

    const media = {
      mimeType: req.file.mimetype,
      body: fs.createReadStream(req.file.path),
    };

    await drive.files.create({
      resource: fileMetadata,
      media: media,
    });

    fs.unlinkSync(req.file.path);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/photos", async (req, res) => {
  const response = await drive.files.list({
    q: `'${FOLDER_ID}' in parents and mimeType contains 'image/'`,
    fields: "files(id)",
  });

  const files = response.data.files.map(file => ({
    url: `https://drive.google.com/uc?id=${file.id}`
  }));

  res.json(files);
});

app.listen(5000);
