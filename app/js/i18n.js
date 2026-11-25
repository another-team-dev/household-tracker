// All interface text, English and Korean side by side: key: [en, ko].
// {n}, {name} … are filled in; {s} becomes "s" when n is not 1 (English only).
const TEXT = {
  appName: ['Household Tracker', '집기록'], tagline: ['Know what is at home and use it before it expires.', '집에 있는 물건을 기억하고, 기한 전에 쓰도록 알려 드려요.'],
  startGuest: ['Start without an account', '계정 없이 시작하기'], guestNote: ['Your items are saved online, but tied to this device. Sign-in with Google comes later.', '물품은 온라인에 저장되지만 이 기기에 연결돼요. Google 로그인은 곧 추가됩니다.'],
  haveCode: ['Someone at home already uses it? Enter the family code', '가족이 이미 쓰고 있나요? 가족 코드를 입력하세요'], codePlaceholder: ['Family code', '가족 코드'], join: ['Join', '참여'],
  loading: ['Loading…', '불러오는 중…'], retry: ['Try again', '다시 시도'], ok: ['OK', '확인'], cancel: ['Cancel', '취소'], save: ['Save', '저장'], done: ['Done', '완료'], back: ['Back', '뒤로'], edit: ['Edit', '편집'], add: ['Add', '추가'], open: ['Open', '열기'], copy: ['Copy', '복사'], create: ['Create', '만들기'], delete: ['Delete', '삭제'], rename: ['Rename', '이름 변경'], change: ['Change', '변경'], show: ['Show', '표시'],
  undo: ['Undo', '되돌리기'], undone: ['Undone.', '되돌렸어요.'], saved: ['Saved.', '저장했어요.'],
  home: ['Home', '홈'], assistant: ['Assistant', '도우미'], reminders: ['Reminders', '알림'], more: ['More', '더보기'], mainNav: ['Main', '주 메뉴'], search: ['Search', '검색'],
  myHome: ['My home', '우리 집'], totalItems: ['{n} item{s} in total', '전체 물품 {n}개'],
  assistCard: ['Tell the assistant what you bought or used', '산 것, 쓴 것을 도우미에게 말해 주세요'], assistExample: ['“Bought milk and 4 yogurts”', '“우유랑 요거트 4개 샀어”'],
  assistantSub: ['Add, update or ask in your own words', '편하게 말하면 추가·수정·검색해 드려요'], assistantSoon: ['The assistant is being moved to the new app and arrives in the next version. Until then, add items by hand.', '도우미는 새 앱으로 옮기는 중이며 다음 버전에 들어옵니다. 그때까지는 직접 추가해 주세요.'],
  needsAttention: ['Needs attention', '확인이 필요해요'], seeAll: ['See all {n}', '{n}개 모두 보기'], nothingDue: ['Nothing is due in the next 7 days.', '7일 안에 기한이 끝나는 물품이 없어요.'],
  categories: ['Categories', '카테고리'], allItems: ['All items', '전체 물품'], uncategorized: ['No category', '카테고리 없음'], newCategory: ['+ New category', '+ 새 카테고리'], newCategoryTitle: ['Name of the new category', '새 카테고리 이름'], renameCategory: ['Rename category', '카테고리 이름 변경'],
  categoriesSub: ['A category can be a place (Fridge) or a type (Medicine).', '카테고리는 장소(냉장고)나 종류(의약품) 어느 쪽이든 괜찮아요.'], noCategories: ['No categories yet.', '아직 카테고리가 없어요.'], deleteCatKeeps: ['Its {n} item{s} will be kept without a category.', '안에 있던 물품 {n}개는 카테고리 없이 그대로 남아요.'],
  nItems: ['{n} item{s}', '{n}개'], nDue: ['{n} due soon', '임박 {n}개'],
  recentlyAdded: ['Recently added', '최근 추가'], addManually: ['Add manually', '직접 추가'], noItemsYet: ['No items yet. Add your first one.', '아직 물품이 없어요. 첫 물품을 추가해 보세요.'],
  shoppingList: ['Shopping list', '장보기 목록'], nothingToBuy: ['Nothing to buy right now.', '지금 살 것이 없어요.'], runningLow: ['Running low', '부족'], nothingLow: ['Nothing is running low.', '부족한 물품이 없어요.'],
  customizeHome: ['Customize this screen', '홈 화면 편집'], customizeTitle: ['Customize Home', '홈 화면 편집'], customizeSub: ['Choose what Home shows and in what order.', '홈에 보일 항목과 순서를 고르세요.'], shown: ['SHOWN', '표시 중'], hidden: ['HIDDEN', '숨김'], alwaysShown: ['Always shown', '항상 표시'], resetDefault: ['Reset to default', '기본값으로 되돌리기'], moveUp: ['Move up', '위로'], moveDown: ['Move down', '아래로'],
  sec_attention: ['Needs attention', '확인이 필요해요'], secd_attention: ['Items that are due soon', '기한이 임박한 물품'], sec_categories: ['Categories', '카테고리'], secd_categories: ['Tiles with item counts', '물품 수가 보이는 타일'], sec_recent: ['Recently added', '최근 추가'], secd_recent: ['The last items you added', '마지막으로 추가한 물품'], sec_shopping: ['Shopping list', '장보기 목록'], secd_shopping: ['What to buy next', '다음에 살 것'], sec_low: ['Running low', '부족한 물품'], secd_low: ['Items marked low or used up', '부족하거나 다 쓴 물품'], secd_assistant: ['Type, speak or take a photo', '입력·음성·사진으로 기록'],
  noDate: ['No date', '날짜 없음'], usedUpLabel: ['Used up', '다 씀'], today: ['Today', '오늘'], daysLeft: ['{n} day{s} left', '{n}일 남음'], daysPast: ['{n} day{s} past', '{n}일 지남'], openedAgo: ['opened {n} day{s} ago', '{n}일 전 개봉'], notOpened: ['not opened yet', '미개봉'],
  searchResults: ['Search results', '검색 결과'], searchingAll: ['Searching every category', '모든 카테고리에서 검색 중'], sortedByDue: ['{n} item{s} · what is due first on top', '{n}개 · 기한이 가까운 순'], searchPlaceholder: ['Search everything at home', '집에 있는 물품 검색'], filter: ['Filter', '필터'],
  fAll: ['All', '전체'], fSoon: ['Due soon', '임박'], fOpened: ['Opened', '개봉'], fLow: ['Low', '부족'], fNoDate: ['No date', '날짜 없음'],
  noMatch: ['Nothing matches “{q}”.', '“{q}”에 해당하는 물품이 없어요.'], noneInFilter: ['No items match this filter. Tap “All” to see everything.', '이 필터에 해당하는 물품이 없어요. “전체”를 누르면 모두 보여요.'], noItemsHere: ['No items here yet.', '아직 물품이 없어요.'],
  addItem: ['Add item', '물품 추가'], addTo: ['Add to {c}', '{c}에 추가'], usedOne: ['Used one', '1개 사용'], usedUp: ['Used up', '다 씀'], threwAway: ['Threw away', '버림'],
  usedOneDone: ['Used one {name}.', '{name} 1개를 사용했어요.'], usedUpDone: ['{name} is used up and left your list.', '{name}을(를) 다 써서 목록에서 뺐어요.'], threwDone: ['{name} was thrown away and left your list.', '{name}을(를) 버려서 목록에서 뺐어요.'],
  itemGone: ['This item no longer exists.', '이 물품은 더 이상 없어요.'], notSet: ['not set', '미입력'], estimated: ['estimated', '추정'], date: ['Date', '날짜'],
  dt_expiration: ['Use by', '소비기한'], dt_bestBefore: ['Best before', '품질유지기한'], dt_sellBy: ['Sell by', '유통기한'], dt_replaceBy: ['Replace by', '교체 예정일'], dt_none: ['No date', '날짜 없음'],
  afterOpening: ['After opening', '개봉 후'], withinDays: ['use within {n} day{s}', '{n}일 이내 사용'], opened: ['Opened', '개봉일'], notYet: ['not yet', '아직 안 함'], haveYouOpened: ['Have you opened it?', '개봉하셨나요?'], openedToday: ['Opened today', '오늘 개봉'], anotherDate: ['Another date…', '다른 날짜…'], whenOpened: ['When did you open it?', '언제 개봉했나요?'],
  ifOpenedToday: ['Opened today means use it by {d}.', '오늘 개봉하면 {d}까지 사용하세요.'], useBy: ['Use it by {d}.', '{d}까지 사용하세요.'], openedDone: ['Marked as opened. Use it by {d}.', '개봉으로 표시했어요. {d}까지 사용하세요.'], notOpenedYet: ['It is not opened after all', '아직 개봉하지 않았어요'], markedUnopened: ['Marked as not opened.', '미개봉으로 표시했어요.'], addAfterOpening: ['Add “use within … days after opening”', '“개봉 후 사용 기간” 추가'],
  replacedToday: ['Replaced today (next in {n} days)', '오늘 교체함 (다음은 {n}일 뒤)'], replacedDone: ['Replaced. Next replacement {d}.', '교체했어요. 다음 교체일은 {d}.'],
  remindersN: ['Reminders · {n}', '알림 · {n}개'], usingDefaults: ['Using the home defaults', '기본 알림 사용 중'], addToShopping: ['Add to shopping list', '장보기 목록에 추가'], addedToShopping: ['{name} is on the shopping list.', '{name}을(를) 장보기 목록에 넣었어요.'], alreadyOnList: ['It is already on the shopping list.', '이미 장보기 목록에 있어요.'],
  deleteItem: ['Delete item', '물품 삭제'], deleteQ: ['Delete “{name}”?', '“{name}”을(를) 삭제할까요?'], deletedDone: ['“{name}” was deleted.', '“{name}”을(를) 삭제했어요.'], addedDone: ['“{name}” was added.', '“{name}”을(를) 추가했어요.'],
  newItem: ['New item', '새 물품'], editItem: ['Edit item', '물품 수정'], name: ['Name', '이름'], category: ['Category', '카테고리'], howMany: ['How many?', '수량'], fewer: ['One fewer', '하나 줄이기'], moreQty: ['One more', '하나 늘리기'], unit: ['Unit', '단위'], unitPlaceholder: ['pcs, cartons…', '개, 팩…'],
  dateOnPackage: ['Date on the package', '포장에 적힌 날짜'], afterOpeningUse: ['After opening, use within', '개봉 후 사용 기간'], days: ['days', '일'], afterOpeningHint: ['Copy it from the package now. The countdown starts later, when you mark the item as opened.', '지금은 포장에 적힌 대로만 입력하세요. 나중에 개봉했다고 표시하면 그때부터 계산해요.'],
  moreDetails: ['More details', '자세히'], dateType: ['What the date means', '날짜 종류'], dateEstimated: ['This date is my estimate', '추정한 날짜예요'], openedOn: ['Opened on', '개봉일'], madeOn: ['Made on', '제조일'], replaceEvery: ['Replace every … days', '교체 주기 (일)'], location: ['Exact spot (optional)', '정확한 위치 (선택)'], markLow: ['Running low', '부족해요'], notes: ['Notes', '메모'],
  remindersDefaultNote: ['Reminders: the home defaults apply. After saving, open the item and tap “Change reminders”.', '알림: 기본 알림이 적용돼요. 저장한 뒤 물품을 열고 “알림 변경”을 누르세요.'],
  errName: ['Enter a name.', '이름을 입력해 주세요.'], errQuantity: ['Enter a number greater than 0, digits only.', '0보다 큰 숫자만 입력해 주세요.'], errDays: ['Days must be a whole number from 1 to 3650.', '일수는 1~3650 사이의 정수로 입력해 주세요.'], errDate: ['Check the date: the year must have four digits.', '날짜를 확인해 주세요. 연도는 네 자리여야 해요.'], errFutureOpen: ['The opening date cannot be in the future.', '개봉일은 미래일 수 없어요.'], errDateOrder: ['The date on the package is earlier than the made-on date.', '포장 날짜가 제조일보다 빨라요.'],
  errOffline: ['No connection. Nothing was changed; try again.', '연결되지 않았어요. 변경된 것은 없으니 다시 시도해 주세요.'], errCode: ['No family has this code. Check it and try again.', '이 코드의 가족이 없어요. 확인하고 다시 시도해 주세요.'], errGuestOff: ['Guest sign-in is not switched on yet.', '게스트 로그인이 아직 켜져 있지 않아요.'], errDuplicateCategory: ['A category with this name already exists.', '같은 이름의 카테고리가 있어요.'], errGeneric: ['That did not work. Nothing was changed.', '처리하지 못했어요. 변경된 것은 없어요.'],
  errAmount: ['Enter a number from 0 to 10000.', '0~10000 사이의 숫자를 입력해 주세요.'], errRepeat: ['Repeat needs a number of at least 1 (at least 5 for minutes).', '반복 간격은 1 이상(분은 5 이상)이어야 해요.'], errCount: ['Number of repeats must be from 1 to 100.', '반복 횟수는 1~100 사이여야 해요.'],
  duplicateQ: ['“{name}” with this date already exists', '같은 날짜의 “{name}”이(가) 이미 있어요'], duplicateBody: ['There is already {q}. Add to it, or cancel to keep a separate entry.', '이미 {q} 있어요. 합치려면 확인, 따로 두려면 취소를 누르세요.'], addToExisting: ['Add to it', '합치기'],
  defaultReminders: ['Default reminders', '기본 알림'], defaultRemindersSub: ['Used for every item that has no reminders of its own', '따로 설정하지 않은 모든 물품에 적용'], dueOn: ['due {d}', '{d}까지'], pushLater: ['Reminders are saved now. Notifications on the phone arrive in a later version.', '알림 설정은 지금 저장돼요. 휴대폰 알림은 다음 버전에서 보내 드려요.'],
  usingDefaultsLong: ['These are the home default reminders. Change, add or delete here and it applies to this item only.', '집 기본 알림이에요. 여기서 바꾸거나 추가·삭제하면 이 물품에만 적용돼요.'], customizeForItem: ['Set different reminders for this item', '이 물품만 따로 설정'], backToDefaults: ['Use the home defaults again', '기본 알림으로 되돌리기'], backToDefaultsQ: ['Remove this item’s own reminders and use the defaults?', '이 물품의 알림을 지우고 기본 알림을 쓸까요?'], noReminders: ['No reminders.', '알림이 없어요.'], addReminder: ['+ Add a reminder', '+ 알림 추가'], reminderDeleted: ['Reminder deleted.', '알림을 삭제했어요.'],
  reminderN: ['Reminder {n}', '알림 {n}'], deleteReminder: ['Delete this reminder', '이 알림 삭제'], closeReminder: ['Close this reminder', '이 알림 접기'], when: ['When', '언제'], amount: ['Number', '숫자'], relativeTo: ['Relative to', '기준'], atTime: ['At what time', '시간'], exactMoment: ['Date and time', '날짜와 시간'], repeat: ['Repeat', '반복'], every: ['every', '간격'], times: ['Number of repeats', '반복 횟수'], stopAfter: ['stop after', ''], moreTimes: ['more times', '번 더 알리고 멈춤'], keepUntilDone: ['keep reminding until I mark it done', '처리할 때까지 계속 알림'],
  a_due: ['before it is due', '기한 전'], a_opened: ['after opening', '개봉 후'], a_fixed: ['exact date', '날짜 지정'],
  u_minutes: ['minute{s}', '분'], u_hours: ['hour{s}', '시간'], u_days: ['day{s}', '일'], u_weeks: ['week{s}', '주'],
  onTheDay: ['On the day', '당일'], onOpeningDay: ['On the day it is opened', '개봉 당일'], nBefore: ['{n} {u} before', '{n}{u} 전'], nAfterOpening: ['{n} {u} after opening', '개봉 {n}{u} 뒤'], everyN: ['every {n} {u}', '{n}{u}마다'], untilDone: ['until done', '처리할 때까지'],
  firesAt: ['First reminder: {d}', '첫 알림: {d}'], thenEvery: ['then every {n} {u}', '이후 {n}{u}마다'], nMoreTimes: ['{n} more time{s}', '{n}번 더'], firesAfterOpen: ['Starts counting when the item is marked as opened.', '개봉으로 표시하면 그때부터 계산해요.'], firesNeedsDate: ['This item has no date yet, so this reminder waits.', '날짜가 없어서 이 알림은 대기 중이에요.'], firesPerItem: ['Calculated from each item’s own date.', '물품마다 날짜에 맞춰 계산해요.'],
  toDealWith: ['{n} to deal with', '처리할 알림 {n}개'], allClear: ['All clear', '모두 처리했어요'],
  guestMode: ['guest mode', '게스트 모드'], signedIn: ['signed in', '로그인됨'], nToBuy: ['{n} to buy', '살 것 {n}개'], homeScreen: ['Home screen', '홈 화면'], homeName: ['Name of your home', '집 이름'], familyCode: ['Family code', '가족 코드'], familyCodeSub: ['Share it so others at home see the same items', '공유하면 가족이 같은 목록을 봐요'], codeCopied: ['Family code copied.', '가족 코드를 복사했어요.'], language: ['Language', '언어'],
  signOut: ['Sign out', '로그아웃'], signOutQ: ['Sign out?', '로그아웃할까요?'], signOutGuestWarn: ['You are in guest mode. After signing out you cannot get back to these items unless someone shares the family code with you.', '게스트 모드예요. 로그아웃하면 가족 코드를 받지 않는 한 이 물품을 다시 볼 수 없어요.'], version: ['Preview version · November 2026', '미리보기 버전 · 2026년 11월'],
  required: ['required', '필수'], tipWhat: ['What is this?', '이게 뭔가요?'], calendar: ['Open calendar', '달력 열기'], errEmpty: ['Type something first.', '먼저 입력해 주세요.'], errFixRed: ['Check the fields marked in red.', '빨갛게 표시된 칸을 확인해 주세요.'],
  errCodeFormat: ['A family code has 18 characters: digits and the letters a–f.', '가족 코드는 숫자와 a–f 글자로 된 18자예요.'], errDateLive: ['This is not a real date. Format: {f}', '올바른 날짜가 아니에요. 형식: {f}'], errDateIncomplete: ['The date is not complete. Format: {f}', '날짜를 끝까지 입력해 주세요. 형식: {f}'],
  dateFormat: ['Date format', '날짜 형식'], dateFormatQ: ['How dates are typed and shown.', '날짜를 입력하고 표시하는 방식이에요.'],
  addManuallyBtn: ['Add an item by hand', '직접 물품 추가'], moreDetailsSub: ['After opening, date type, replacement, notes…', '개봉 후 기간, 날짜 종류, 교체 주기, 메모…'], locationPlaceholder: ['e.g. top shelf, door, blue box', '예: 맨 위 칸, 문 쪽, 파란 상자'],
  clearOpened: ['Remove the opening date', '개봉일 지우기'], ownReminders: ['set for this item', '이 물품 전용'], changeReminders: ['Change reminders', '알림 변경'],
  remindLater: ['Remind me later', '나중에 다시 알림'], remindLaterQ: ['Remind me about “{name}”…', '“{name}” 다시 알림…'], snoozeNote: ['It leaves this list and comes back at that time.', '목록에서 잠시 사라졌다가 그 시간에 다시 나타나요.'], in1h: ['In 1 hour', '1시간 뒤'], tonight: ['Tonight at 21:00', '오늘 밤 9시'], tomorrowMorning: ['Tomorrow at 09:00', '내일 오전 9시'], in3days: ['In 3 days', '3일 뒤'], snoozeDone: ['I will remind you again {d}.', '{d}에 다시 알려 드릴게요.'], snoozedSection: ['COMING BACK LATER', '나중에 다시 알림'], snoozedUntil: ['comes back {d}', '{d}에 다시 표시'], remindNow: ['Show it now', '지금 표시'],
  tip_code: ['The code is under More → Family code in the app of someone who already uses it. Entering it shows you the same items.', '이미 쓰는 가족의 앱에서 더보기 → 가족 코드에 있어요. 입력하면 같은 물품을 함께 봐요.'],
  tip_category: ['A group for your items: a place (Fridge) or a kind (Medicine). Optional.', '물품을 묶는 그룹이에요. 장소(냉장고)나 종류(의약품) 모두 괜찮아요. 선택 사항.'], tip_qty: ['How many you have. “Used one” lowers it; at zero the item leaves your list.', '가지고 있는 개수예요. “1개 사용”을 누르면 줄고, 0이 되면 목록에서 빠져요.'], tip_unit: ['What you count in: pcs, cartons, bottles. Optional.', '세는 단위예요: 개, 팩, 병. 선택 사항.'],
  tip_date: ['The date printed on the package. Leave empty if there is none.', '포장에 인쇄된 날짜예요. 없으면 비워 두세요.'], tip_pao: ['Some products say “use within N days after opening”. Copy that number here. The countdown starts when you mark the item as opened.', '“개봉 후 N일 이내 사용”이라고 적힌 제품이 있어요. 그 숫자를 적어 두면, 개봉했다고 표시할 때부터 계산해요.'], tip_openedOn: ['Only if it is already open. Otherwise leave empty and tap “Opened today” later.', '이미 개봉했을 때만 입력하세요. 아니면 비워 두고 나중에 “오늘 개봉”을 누르세요.'],
  tip_dateType: ['What the printed date means. “Use by”: do not use after it. “Best before”: quality drops after it. “Replace by”: for filters, batteries.', '인쇄된 날짜의 의미예요. 소비기한: 지나면 쓰지 않기. 품질유지기한: 지나면 품질 저하. 교체 예정일: 필터, 건전지 등.'], tip_estimated: ['Tick it when you are guessing the date, for example for home-made food.', '직접 만든 음식처럼 날짜를 어림잡았을 때 체크하세요.'], tip_madeOn: ['Production date, when the package shows it instead of an expiry date.', '기한 대신 제조일만 적혀 있을 때 입력하세요.'],
  tip_replace: ['For things you swap regularly (filters, toothbrush heads). “Replaced today” then sets the next date for you.', '정기적으로 바꾸는 물건(필터, 칫솔모)에 써요. “오늘 교체함”을 누르면 다음 날짜가 자동으로 정해져요.'], tip_location: ['A note on where it is inside the category, so others at home can find it. Optional.', '카테고리 안에서 어디에 있는지 적어 두면 가족이 찾기 쉬워요. 선택 사항.'], tip_low: ['Marks the item as nearly finished, so it shows under “Running low”.', '거의 다 써 간다고 표시해요. “부족” 목록에 나타나요.'],
  makeDefault: ['Use this reminder for all items by default', '이 알림을 모든 물품의 기본으로 사용'], madeDefault: ['Added to the home defaults. It applies to new items and to items without their own reminders.', '기본 알림에 추가했어요. 새 물품과 전용 알림이 없는 물품에 적용돼요.'], alreadyDefault: ['The same reminder is already a default.', '같은 알림이 이미 기본에 있어요.'],
  shoppingSub: ['Ticking an entry adds it to your stock', '체크하면 재고에 더해져요'], addToBuy: ['Add something to buy', '살 것 추가'], bought: ['Bought', '구매 완료'],
};
let lang = localStorage.getItem('ht-lang') || ((navigator.language || '').startsWith('ko') ? 'ko' : 'en');
export const getLang = () => lang;
export function setLang(l) { lang = l === 'ko' ? 'ko' : 'en'; try { localStorage.setItem('ht-lang', lang); } catch { /* private mode */ } }
export function t(key, vars = {}) {
  const pair = TEXT[key];
  if (!pair) return key;
  return pair[lang === 'ko' ? 1 : 0].replace(/\{(\w+)\}/g, (_, k) => (k === 's' ? (Number(vars.n) === 1 ? '' : 's') : vars[k] ?? ''));
}
const loc = () => (lang === 'ko' ? 'ko-KR' : 'en-GB');
// Date formats people can choose under More. order = which part comes first, sep = the separator.
export const DATE_FORMATS = { 'ymd.': ['ymd', '.'], 'ymd-': ['ymd', '-'], 'dmy.': ['dmy', '.'], 'dmy/': ['dmy', '/'], 'mdy/': ['mdy', '/'] };
const guessFormat = () => { const l = navigator.language || ''; return /^(ko|ja|zh|hu|lt)/.test(l) ? 'ymd.' : /^en-US/.test(l) ? 'mdy/' : /^(ru|de|uk|pl|cs|fi|nb|tr)/.test(l) ? 'dmy.' : 'dmy/'; };
let dateFormat = DATE_FORMATS[localStorage.getItem('ht-date')] ? localStorage.getItem('ht-date') : guessFormat();
export const getDateFormat = () => dateFormat;
export function setDateFormat(f) { if (!DATE_FORMATS[f]) return; dateFormat = f; try { localStorage.setItem('ht-date', f); } catch { /* private mode */ } }
const LEN = { y: 4, m: 2, d: 2 };
export function fmtDate(isoDate, f = dateFormat) { const [y, m, d] = isoDate.split('-'); const [order, sep] = DATE_FORMATS[f]; return [...order].map((k) => ({ y, m, d }[k])).join(sep); }
export function datePlaceholder(f = dateFormat) { const [order, sep] = DATE_FORMATS[f]; return [...order].map((k) => ({ y: 'YYYY', m: 'MM', d: 'DD' }[k])).join(sep); }
// Puts the separators in while digits are typed: 13122026 -> 13.12.2026
export function maskDate(raw) {
  const [order, sep] = DATE_FORMATS[dateFormat];
  let digits = raw.replace(/\D/g, '').slice(0, 8), out = '';
  for (const k of order) { if (!digits) break; const part = digits.slice(0, LEN[k]); digits = digits.slice(LEN[k]); out += part + (part.length === LEN[k] && k !== order[2] ? sep : ''); }
  return raw.length < out.length && out.endsWith(sep) ? out.slice(0, -1) : out; // lets Backspace remove a separator
}
// 'ok' with the ISO date, 'partial' while still being typed, or 'bad' when it can no longer become a real date.
export function dateState(text) {
  const [order] = DATE_FORMATS[dateFormat];
  let digits = text.replace(/\D/g, '');
  if (/[^\d./\- ]/.test(text) || digits.length > 8) return { state: 'bad' };
  const p = {};
  for (const k of order) { p[k] = digits.slice(0, LEN[k]); digits = digits.slice(LEN[k]); }
  const full = (k) => p[k].length === LEN[k];
  if (full('m') && (+p.m < 1 || +p.m > 12)) return { state: 'bad' };
  if (full('d') && (+p.d < 1 || +p.d > 31)) return { state: 'bad' };
  if (full('y') && (+p.y < 1990 || +p.y > 2099)) return { state: 'bad' };
  if (!(full('y') && full('m') && full('d'))) return { state: 'partial' };
  const dt = new Date(+p.y, +p.m - 1, +p.d);
  if (dt.getMonth() !== +p.m - 1 || dt.getDate() !== +p.d) return { state: 'bad' }; // 31 April, 30 February…
  return { state: 'ok', iso: `${p.y}-${p.m}-${p.d}` };
}
export function fmtDateTime(v) { const d = new Date(v); const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; return d.toLocaleDateString(loc(), { weekday: 'short' }) + ' ' + fmtDate(day) + ', ' + d.toLocaleTimeString(loc(), { hour: '2-digit', minute: '2-digit', hour12: false }); }
export const KEYS = Object.keys(TEXT);
