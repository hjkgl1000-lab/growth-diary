import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import ImageKit from 'imagekit';
import path from 'path';
import { fileURLToPath } from 'url';
import { query, withTransaction, init, randomUUID } from './db.js';

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
  const { child_id, record_date, content, author } = req.body;
  if (!child_id || !record_date) {
    return res.status(400).json({ message: '아이와 날짜는 꼭 필요해요.' });
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const files = req.files || [];
  const uploadedFileIds = []; // 트랜잭션이 실패하면 ImageKit에서도 같이 지워주기 위한 목록

  try {
    await withTransaction(async (client) => {
      await client.query(
        'INSERT INTO records (id, child_id, record_date, content, author, created_at) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, child_id, record_date, content || '', author || '', now]
      );

      let position = 0;
      for (const file of files) {
        const result = await uploadToImageKit(file.buffer, file.originalname || `photo-${Date.now()}.jpg`);
        uploadedFileIds.push(result.fileId);
        await client.query(
          'INSERT INTO photos (id, record_id, url, file_id, width, height, position, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
          [randomUUID(), id, result.url, result.fileId, result.width, result.height, position++, now]
        );
      }
    });

    res.json({ ok: true, id });
  } catch (e) {
    // 기록 저장이 실패하면 텍스트만 남는 반쪽짜리 기록이 생기지 않도록 전체를 롤백하고,
    // 이미 ImageKit에 올라간 사진이 있다면 같이 지워서 DB와 상태를 맞춘다.
    console.error('기록 저장 실패:', e);
    for (const fileId of uploadedFileIds) {
      try {
        await imagekit.deleteFile(fileId);
      } catch (cleanupErr) {
        console.error('업로드 정리 실패:', cleanupErr);
      }
    }
    res.status(500).json({ message: '저장 중 문제가 생겼어요. 다시 시도해주세요.' });
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

// multer(사진 업로드) 에러를 JSON으로 응답 — 안 그러면 브라우저가 에러 화면을 못 읽어서
// "저장 실패" 안내조차 못 보고 그냥 조용히 실패한 것처럼 보임
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    console.error('업로드 오류:', err);
    return res.status(400).json({ message: '사진 파일이 너무 크거나(25MB 초과) 형식에 문제가 있어요.' });
  }
  console.error(err);
  res.status(500).json({ message: '서버에 문제가 생겼어요.' });
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
