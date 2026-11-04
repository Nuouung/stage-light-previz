# stage-light-previz

배우에게 공유하는 조명 계획 시각화 도구. 공연장과 공연을 합성한 3D 무대에서 큐별 조명의 느낌과 인물 위치를 보여 준다. 정밀한 조명 설계는 Capture에서 한다.

**화면:** https://nuouung.github.io/stage-light-previz/ (main) · https://nuouung.github.io/stage-light-previz/develop/ (develop)

설계·결정 기록은 드라이브 베이스캠프(`조명 시뮬레이터` 폴더)에 있다. 이 저장소에는 코드와 데이터만 둔다.

## 폴더

| 폴더 | 내용 |
|---|---|
| `src/model` | 타입 정의 겸 데이터 검사 규칙. **검수의 기준** |
| `src/stage` | 공연용 무대 합성 (공연장 + 공연 물체 + 막 설정) |
| `src/player` | 큐 계산: 트래킹, 페이드, 큐 넘기기. 순수 함수 |
| `src/store` | 상태 저장소 (발행·구독) |
| `data/stages` | 공연장: 건물 치수와 막 |
| `data/projects` | 작품: 세트 정의, 인물, 장, 큐 목록 (공연장이 바뀌어도 그대로) |
| `data/stagings` | 배치: 작품 × 공연장. 세트 위치, 막 설정, 큐별 조명값·인물 위치 |
| `public/avatars` | 인물 모형 파일(CC0). 출처는 폴더의 README |
| `src/view/stage3d` | 3D 화면. 인물은 모형 불러오기(`avatar`), 자세표(`pose`), 세우기(`figure`) |
| `tools` | 모형 변환 스크립트 (모형을 바꿀 때만 돌림) |
| `tests` | 테스트. 이름이 곧 동작 설명 |

## 데이터 규칙

- 좌표: 원점 = 무대 앞끝 중앙·바닥, 단위 m, x 상수 쪽 +, y 위 +, z 무대 안쪽 +
- 공연장(stages) · 작품(projects) · 배치(stagings)는 서로 독립. 공연장이 바뀌면 배치만 새로 만든다
- 조명은 실제 조명기가 아니라 **구역 × 방향**으로 적는다. 구역은 `down/up`-`left/center/right` 6칸(left는 객석에서 왼쪽, 하수), 방향은 `front/top/back`
- 화면의 밝기와 빛 모양은 눈으로 맞춘 값이다. 실제 공연 조명과 다를 수 있다
- 큐는 **트래킹**: 바뀐 빛·인물만 적고, 안 적은 건 이전 큐 값을 유지
- 인물 키가 없으면 1.7m
- 인물 모형은 `characters[].avatar`로 고른다. 바꾸려면 이 한 줄만 고치면 된다
- 배우 실명·연락처, 극장 원본 자료는 넣지 않는다

## 명령

```
npm install
npm run dev        # 로컬 화면
npm test           # 테스트 + 데이터 검사
npm run typecheck  # 타입 검사
```

## 브랜치와 배포

작업은 `develop`에서 하고, 공유할 때 `main`에 합친다. 어느 쪽에 올려도 두 브랜치를 함께 빌드해 사이트 하나로 배포한다. `develop` 빌드나 테스트가 실패하면 그 배포에서는 `/develop/` 화면이 빠지고 `main` 화면은 그대로 올라간다.
