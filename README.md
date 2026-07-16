# 우리 아이 성장일기

유빈, 해인이의 사진과 기록을 가족끼리 공유하는 웹앱입니다.

## 이 앱은 무엇으로 만들어졌나요?

- 화면(사진 보고, 기록 남기는 부분): 그냥 HTML/CSS/자바스크립트 — 별도 설치 없이 브라우저에서 바로 동작
- 서버: Node.js (Express) — 가벼운 서버 프로그램
- 기록 저장: Neon (무료 데이터베이스, 신용카드 필요 없음)
- 사진 저장: ImageKit (무료 사진 저장소, 넉넉한 무료 용량, 신용카드 필요 없음) — 사진을 원본 화질 그대로 저장합니다
- 앱을 인터넷에 올리는 곳: Render.com (무료, 신용카드 필요 없음)

전부 신용카드 없이 무료로 가입할 수 있는 곳들로만 골랐습니다.

---

## 무료로 인터넷에 올려서 동생과 함께 쓰는 방법 (전문 용어 없이 설명)

전체 순서: **① 사진 저장소 만들기 → ② 기록 저장소 만들기 → ③ 코드를 깃허브에 올리기 → ④ Render에서 실행시키기**

### ① ImageKit 가입하기 (사진 저장소)

1. https://imagekit.io 접속 → "Sign up free" (또는 "Get Started") 클릭
2. 이메일 또는 구글 계정으로 가입 (신용카드 요구 안 함, 휴대폰 번호 인증은 요구할 수 있음)
3. 가입 중에 "URL Endpoint 이름을 정해주세요" 같은 화면이 나오면 아무거나 입력 (예: 본인 이름)
4. 가입이 끝나면 왼쪽 메뉴에서 **Developer options** (또는 **API Keys**) 클릭
5. 화면에 아래 3개 값이 보여요:
   - **Public key**
   - **Private key** (눈 모양 아이콘을 눌러야 값이 보일 수 있음)
   - **URL-endpoint** (`https://ik.imagekit.io/...` 형태)
6. 이 3개 값을 메모장에 잠깐 복사해두세요. (나중에 Render에 붙여넣을 거예요)

### ② Neon 가입하기 (기록/글 저장소)

1. https://neon.tech 접속 → "Sign up" 클릭 (구글 계정으로도 가능)
2. 가입 후 "Create a project" 버튼으로 새 프로젝트 만들기 (이름은 아무거나, 예: growth-diary)
3. 프로젝트가 만들어지면 **Connection string** 이라는 긴 문자열이 보여요. (`postgresql://...` 로 시작해요)
   - "Copy" 버튼을 눌러 복사해두세요.
4. 이 값도 메모장에 복사해두세요.

### ③ 코드를 깃허브(GitHub)에 올리기

깃허브는 코드를 보관하는 창고 같은 곳이에요. Render가 여기서 코드를 가져가서 실행시켜 줍니다.

1. https://github.com 접속 → 계정이 없다면 가입
2. 오른쪽 위 `+` 버튼 → **New repository** 클릭
3. Repository name에 `growth-diary` 입력 → **Public** 선택 → **Create repository**
4. 저장소가 만들어지면 화면에 **"uploading an existing file"** 이라는 링크가 보여요. 그걸 클릭하세요.
5. 이 프로젝트 폴더 안에 있는 파일들을 전부(폴더 구조 그대로) 마우스로 끌어다 놓으세요.
   - `growth-diary` 폴더 안의 `public` 폴더까지 통째로 끌어다 놓으면 됩니다.
   - `.env` 파일은 올리지 마세요 (없으니 걱정 안 하셔도 돼요 — `.env.example`만 있으면 됩니다)
6. 아래 "Commit changes" 초록 버튼 클릭 → 업로드 완료

### ④ Render에서 실제로 앱을 실행시키기

1. https://render.com 접속 → "Get Started" → 깃허브 계정으로 가입 (신용카드 필요 없음)
2. 대시보드에서 **New +** → **Web Service** 클릭
3. 방금 만든 `growth-diary` 저장소를 선택하고 **Connect**
4. 설정 화면에서:
   - **Name**: 아무 이름 (예: growth-diary)
   - **Region**: Singapore (한국에서 제일 가까움)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free 선택
5. 화면을 아래로 내리면 **Environment Variables** (환경 변수) 항목이 있어요.
   이건 비밀번호 같은 값들을 코드에 직접 적지 않고 안전하게 넣어두는 곳이에요.
   "Add Environment Variable"을 눌러서 아래 항목들을 하나씩 추가하세요.

   | Key (이름) | Value (값) |
   |---|---|
   | `FAMILY_PASSWORD` | 가족들이 쓸 비밀번호 (원하는 걸로, 예: yubinhaein2024) |
   | `DATABASE_URL` | ②에서 복사한 Neon 연결 문자열 |
   | `IMAGEKIT_PUBLIC_KEY` | ①에서 복사한 Public key |
   | `IMAGEKIT_PRIVATE_KEY` | ①에서 복사한 Private key |
   | `IMAGEKIT_URL_ENDPOINT` | ①에서 복사한 URL-endpoint |

6. 맨 아래 **Create Web Service** 클릭
7. 3~5분 정도 기다리면 위쪽에 `https://growth-diary-xxxx.onrender.com` 같은 주소가 생겨요.
8. 그 주소를 클릭해서 앱이 뜨는지 확인하고, ⑤번에서 정한 비밀번호로 들어가 보세요.
9. 이 주소를 동생에게 카톡으로 보내주면, 같은 비밀번호로 들어와서 같이 기록을 남길 수 있어요!

### 알아두면 좋은 점

- Render 무료 요금제는 15분간 아무도 안 들어오면 서버가 잠들어요. 그 다음 처음 접속할 때 30초 정도 로딩이 걸릴 수 있어요 (정상입니다, 다시 기다리면 떠요).
- ImageKit 무료 요금제는 넉넉한 무료 용량을 줘요(정확한 한도는 가입 시 화면에서 확인 가능). 휴대폰으로 찍은 사진은 거의 다 문제없이 올라가고, 수천 장은 넉넉하게 저장할 수 있어요.
- 나중에 코드를 수정하고 싶으면, 깃허브 저장소에서 파일을 다시 업로드(덮어쓰기)하면 Render가 자동으로 다시 배포해줘요.
- 가족 비밀번호를 바꾸고 싶으면 Render 대시보드 → Environment → `FAMILY_PASSWORD` 값만 수정하면 돼요.

---

## 내 컴퓨터에서 미리 테스트해보고 싶다면 (선택 사항)

1. https://nodejs.org 에서 Node.js 설치 (LTS 버전)
2. 이 폴더에서 `.env.example` 파일을 복사해서 이름을 `.env` 로 바꾸고, 위 ①②에서 받은 값들을 채워넣기
3. 폴더에서 명령 프롬프트(터미널) 열고:
   ```
   npm install
   npm start
   ```
4. 브라우저에서 `http://localhost:3000` 접속
