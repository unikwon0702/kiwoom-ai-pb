/**
 * 상대시간 표시 유틸리티
 * 
 * - formatRelativeTime: 실제 timestamp를 상대시간으로 변환
 * - formatDemoRelativeTime: 샘플데이터용 인덱스 기반 상대시간 생성
 * - getDisplayTime: 실제/데모 자동 판별하여 적절한 시간 표시 반환
 */

// 샘플 데이터의 기준일 패턴 (7일 이상 지난 날짜는 샘플로 판단)
const SAMPLE_THRESHOLD_DAYS = 3;

/**
 * 날짜가 샘플 스냅샷 데이터인지 판단
 * 현재 시점에서 SAMPLE_THRESHOLD_DAYS 이상 지난 날짜를 샘플로 간주
 */
export function isSampleSnapshotDate(date: Date | string | null | undefined): boolean {
  if (!date) return true;
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return true;
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays > SAMPLE_THRESHOLD_DAYS;
}

/**
 * 실제 timestamp를 상대시간 문자열로 변환
 * 
 * 규칙:
 * - 0~2분: 방금
 * - 3~59분: N분 전
 * - 1~23시간: N시간 전
 * - 24~47시간: 어제
 * - 2~6일: N일 전
 * - 7일 이상: MM.DD 형식
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMin < 0) return '방금'; // 미래 날짜 처리
  if (diffMin <= 2) return '방금';
  if (diffMin <= 59) return `${diffMin}분 전`;
  if (diffHours <= 23) return `${diffHours}시간 전`;
  if (diffHours <= 47) return '어제';
  if (diffDays <= 6) return `${diffDays}일 전`;

  // 7일 이상: MM.DD 형식
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${month}.${day}`;
}

/**
 * 데모/샘플 데이터용 상대시간 생성
 * 인덱스 기반으로 deterministic한 시간 표시를 생성
 * 
 * 배열:
 * index 0: 방금
 * index 1: 7분 전
 * index 2: 18분 전
 * index 3: 32분 전
 * index 4: 42분 전
 * index 5: 1시간 전
 * index 6: 1시간 전
 * index 7: 2시간 전
 * index 8: 3시간 전
 * index 9+: 어제 또는 N시간 전
 */
const DEMO_TIME_OFFSETS = [
  '방금',
  '7분 전',
  '18분 전',
  '32분 전',
  '42분 전',
  '1시간 전',
  '1시간 전',
  '2시간 전',
  '3시간 전',
  '어제',
  '어제',
  '어제',
  '2일 전',
  '2일 전',
  '3일 전',
];

export function formatDemoRelativeTime(index: number): string {
  if (index < 0) return '방금';
  if (index < DEMO_TIME_OFFSETS.length) return DEMO_TIME_OFFSETS[index];
  // index가 배열 범위를 초과하면 일 단위로 증가
  const extraDays = Math.floor((index - DEMO_TIME_OFFSETS.length) / 3) + 4;
  return `${extraDays}일 전`;
}

/**
 * 메인 함수: 실제/데모 자동 판별하여 적절한 시간 표시 반환
 * 
 * @param date - 원본 날짜 (ISO string 또는 Date)
 * @param index - 리스트 내 순서 (데모 시간 생성용)
 * @returns 표시할 상대시간 문자열
 */
export function getDisplayTime(
  date: Date | string | null | undefined,
  index: number = 0
): string {
  // 날짜가 없으면 데모 시간 사용
  if (!date) return formatDemoRelativeTime(index);

  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return formatDemoRelativeTime(index);

  // 실제 최신 데이터인 경우 실제 상대시간 표시
  if (!isSampleSnapshotDate(d)) {
    return formatRelativeTime(d);
  }

  // 샘플 데이터인 경우 데모 상대시간 표시
  return formatDemoRelativeTime(index);
}
