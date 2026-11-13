// Every string the game shows, per language. Each language has exactly the
// keys English has (test/i18n.test.js checks). The name UPDRAFT is not
// translated. A language's own name (`langName`) is shown in that language.

export const STRINGS = Object.freeze({
  en: {
    langName: 'English',
    canvasLabel: 'Updraft game: press Space or tap to flap', // for screen readers
    tapToFly: 'Tap to fly',
    clickToFly: 'Click or press Space to fly',
    best: n => `Best ${n}`,
    levels: { easy: 'Easy', normal: 'Normal', hard: 'Hard' },
    blurb: {
      easy: 'Grab shiny things for extra lives',
      normal: 'One life. Steady pillars.',
      hard: 'One life. Drifting pillars, updrafts.',
    },
    keysHint: '← → level · P pause · M sound',
    medals: { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' },
    medalToast: medal => `${medal} medal!`,
    grounded: 'Grounded',
    score: 'Score',
    levelBest: level => `${level} best`,
    newBest: 'New best!',
    nextMedal: (medal, score) => `${medal} at ${score}`,
    tapContinue: 'Tap to continue',
    spaceContinue: 'Space to continue',
    paused: 'Paused',
    tapResume: 'Tap to resume',
    clickResume: 'P or click to resume',
    settings: 'Settings',
    sound: 'Sound',
    on: 'On',
    off: 'Off',
    theme: 'Theme',
    themes: { purple: 'Purple', classic: 'Classic' },
    language: 'Language',
    done: 'Done',
  },
  zh: {
    langName: '简体中文',
    canvasLabel: 'Updraft 游戏：按空格键或点击屏幕振翅',
    tapToFly: '点击起飞',
    clickToFly: '点击或按空格键起飞',
    best: n => `最高分 ${n}`,
    levels: { easy: '简单', normal: '普通', hard: '困难' },
    blurb: {
      easy: '收集闪亮宝物，获得额外生命',
      normal: '一条命，柱子不动',
      hard: '一条命，柱子浮动，还有上升气流',
    },
    keysHint: '← → 难度 · P 暂停 · M 音效',
    medals: { bronze: '铜牌', silver: '银牌', gold: '金牌' },
    medalToast: medal => `获得${medal}！`,
    grounded: '坠落了',
    score: '得分',
    levelBest: level => `${level}最高分`,
    newBest: '新纪录！',
    nextMedal: (medal, score) => `${score} 分得${medal}`,
    tapContinue: '点击继续',
    spaceContinue: '按空格键继续',
    paused: '已暂停',
    tapResume: '点击继续',
    clickResume: '按 P 或点击继续',
    settings: '设置',
    sound: '音效',
    on: '开',
    off: '关',
    theme: '主题',
    themes: { purple: '紫色', classic: '经典' },
    language: '语言',
    done: '完成',
  },
})
export const LANGS = Object.freeze(Object.keys(STRINGS))

/** The language to start in: the first of the browser's languages we have, else English. */
export function defaultLang(browserLangs) {
  for (const tag of browserLangs ?? []) {
    const l = String(tag).toLowerCase().split('-')[0]
    if (LANGS.includes(l)) return l
  }
  return 'en'
}
