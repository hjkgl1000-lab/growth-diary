import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, init, randomUUID } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 파일 1장당 25MB까지 (휴대폰 원본 사진은 대부분 이 안에 들어옵니다)
});

const imagekit = new ImageKit({
  publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
});

async function uploadToImageKit(buffer, filename) {
  // useUniqueFileName: 같은 이름 사진이 겹쳐도 안전하도록, 변환 없이 원본 화질 그대로 저장
  return imagekit.upload({
    file: buffer,
    fileName: filename,
    folder: '/growth-diary',
    useUniqueFileName: true,
  });
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const FAMILY_PASSWORD = process.env.FAMILY_PASSWORD || 'family';

app.post('/api/login', (req, res) => {
  const { password } = req.body || {};
  if (password === FAMILY_PASSWORD) return res.json({ ok: true });
  res.status(401).json({ ok: false, message: '비밀번호가 틀렸어요.' });
});

// 아래부터는 가족 비밀번호가 맞아야 접근 가능
app.use('/api', (req, res, next) => {
  if (req.header('x-family-password') === FAMILY_PASSWORD) return next();
  res.status(401).json({ message: '로그인이 필요해요.' });
});

app.get('/api/children', async (req, res) => {
  const rows = await query('SELECT * FROM children ORDER BY created_at ASC');
  res.json(rows);
});

app.post('/api/children', async (req, res) => {
  const { name, birthdate, color } = req.body;
  if (!name || !birthdate) {
    return res.status(400).json({ message: '이름과 생년월일을 입력해주세요.' });
  }
  const id = randomUUID();
  await query(
    'INSERT INTO children (id, name, birthdate, color, created_at) VALUES ($1,$2,$3,$4,$5)',
    [id, name, birthdate, color || 'white', new Date().toISOString()]
  );
  res.json({ ok: true, id });
});

app.put('/api/children/:id', async (req, res) => {
  const { name, birthdate, color } = req.body;
  await query('UPDATE children SET name=$1, birthdate=$2, color=$3 WHERE id=$4', [
    name,
    birthdate,
    color,
    req.params.id,
  ]);
  res.json({ ok: true });
});

app.get('/api/records', async (req, res) => {
  const { child_id } = req.query;
  const records = child_id
    ? await query(
        'SELECT * FROM records WHERE child_id=$1 ORDER BY record_date DESC, created_at DESC',
        [child_id]
      )
    : await query('SELECT * FROM records ORDER BY record_date DESC, created_at DESC');

  const ids = records.map((r) => r.id);
  const photosByRecord = {};
  if (ids.length) {
    const photos = await query(
      'SELECT * FROM photos WHERE record_id = ANY($1) ORDER BY position ASC',
      [ids]
    );
    for (const p of photos) {
      (photosByRecord[p.record_id] ||= []).push(p);
    }
  }

  res.json(records.map((r) => ({ ...r, photos: photosByRecord[r.id] || [] })));
});

app.post('/api/records', upload.array('photos', 20), async (req, res) => {
  try {
    const { child_id, record_date, content, author } = req.body;
    if (!child_id || !record_date) {
      return res.status(400).json({ message: '아이와 날짜는 꼭 필요해요.' });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    await query(
      'INSERT INTO records (id, child_id, record_date, content, author, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, child_id, record_date, content || '', author || '', now]
    );

    const files = req.files || [];
    let position = 0;
    for (const file of files) {
      const result = await uploadToImageKit(file.buffer, file.originalname || `photo-${Date.now()}.jpg`);
      await query(
        'INSERT INTO photos (id, record_id, url, file_id, width, height, position, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
        [randomUUID(), id, result.url, result.fileId, result.width, result.height, position++, now]
      );
    }

    res.json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: '저장 중 문제가 생겼어요.' });
  }
});

app.delete('/api/records/:id', async (req, res) => {
  const photos = await query('SELECT * FROM photos WHERE record_id=$1', [req.params.id]);
  for (const p of photos) {
    if (p.file_id) {
      try {
        await imagekit.deleteFile(p.file_id);
      } catch (e) {
        console.error(e);
      }
    }
  }
  await query('DELETE FROM photos WHERE record_id=$1', [req.params.id]);
  await query('DELETE FROM records WHERE id=$1', [req.params.id]);
  res.json({ ok: true });
});

const PORT = process.env.PORT || 3000;
init()
  .then(() => {
    app.listen(PORT, () => console.log(`서버 실행 중: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('DB 초기화 실패', err);
    process.exit(1);
  });
