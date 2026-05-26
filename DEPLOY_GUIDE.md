# AI PB Databricks App - 1단계 배포 가이드

## GitHub 리포 작업 순서

### Step 1: 리포 구조 변경
```bash
# kiwoom-ai-pb 리포 root에서
cd kiwoom-ai-pb

# 기존 소스를 frontend/ 으로 이동
mv "3rd edition-aipb-v022-260520" frontend

# SSR 전용 파일 삭제
rm -f frontend/src/server.ts
rm -f frontend/src/start.ts
rm -f frontend/src/lib/error-capture.ts
rm -f frontend/src/lib/error-page.ts
rm -f frontend/wrangler.jsonc
```

### Step 2: package.json 수정 (frontend/package.json)

**제거할 dependencies:**
```json
"@cloudflare/vite-plugin"
"@tanstack/react-start"
"@lovable.dev/vite-tanstack-config"
"wrangler"
```

**추가할 devDependencies:**
```json
"@vitejs/plugin-react-swc": "^4.0.0"
"@tanstack/router-plugin": "^1.0.0"
```

**scripts 수정:**
```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  }
}
```

### Step 3: 파일 교체/추가
```bash
# 이 폴더의 파일들을 리포로 복사
cp app.yaml           → kiwoom-ai-pb/app.yaml
cp app.py             → kiwoom-ai-pb/app.py
cp requirements.txt   → kiwoom-ai-pb/requirements.txt
cp -r backend/        → kiwoom-ai-pb/backend/

# frontend 내부 파일 교체
cp frontend/index.html            → kiwoom-ai-pb/frontend/index.html
cp frontend/src/main.tsx           → kiwoom-ai-pb/frontend/src/main.tsx
cp frontend/src/lib/api.ts         → kiwoom-ai-pb/frontend/src/lib/api.ts
cp frontend/vite.config.ts         → kiwoom-ai-pb/frontend/vite.config.ts
cp frontend/src/routes/__root.tsx  → kiwoom-ai-pb/frontend/src/routes/__root.tsx
```

### Step 4: Frontend 빌드
```bash
cd frontend
npm install
npm run build   # → ../dist/ 생성
```

### Step 5: Databricks App 배포
```bash
# Databricks CLI 사용
databricks apps deploy kiwoom-ai-pb --source-code-path /Workspace/Repos/cheeun.kwon@pwc.com/kiwoom-ai-pb

# 또는 Workspace Git Folder sync 후 App UI에서 Deploy
```

## 검증 체크리스트
- [ ] `https://<app-url>/docs` → FastAPI Swagger UI 표시
- [ ] `https://<app-url>/api/dashboard` → JSON 응답
- [ ] `https://<app-url>/` → React SPA 표시 (Mock 데이터)
- [ ] `https://<app-url>/chat` → SPA 라우팅 정상

## 파일 구조 (최종)
```
kiwoom-ai-pb/
├── app.yaml
├── app.py
├── requirements.txt
├── backend/
│   ├── __init__.py
│   ├── db_client.py
│   └── genie_client.py
├── dist/                 ← npm run build 결과 (git ignore)
│   ├── index.html
│   └── assets/
└── frontend/
    ├── package.json      (수정)
    ├── vite.config.ts    (교체)
    ├── index.html        (신규)
    ├── tsconfig.json
    └── src/
        ├── main.tsx      (신규)
        ├── router.tsx    (기존 유지)
        ├── routeTree.gen.ts (자동 재생성)
        ├── styles.css
        ├── lib/
        │   ├── api.ts    (신규)
        │   └── utils.ts  (기존)
        ├── hooks/
        ├── components/pb/    (14개 유지)
        ├── components/ui/    (38개 유지)
        └── routes/
            ├── __root.tsx    (교체)
            ├── index.tsx
            ├── chat.tsx
            └── notifications.tsx
```
