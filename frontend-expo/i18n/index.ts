import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';

const resources = {
  en: {
    translation: {
      // Navigation
      'nav.home': 'Home',
      'nav.books': 'Books',
      'nav.submit': 'Submit',
      'nav.profile': 'Profile',

      // Auth
      'auth.login': 'Login',
      'auth.register': 'Register',
      'auth.email': 'Email',
      'auth.password': 'Password',
      'auth.username': 'Username',
      'auth.logout': 'Logout',

      // Home
      'home.title': 'AI Novel Platform',
      'home.subtitle': 'Reader-driven AI novel creation',
      'home.latest': 'Latest Novels',
      'home.empty': 'No novels yet. Be the first to submit!',

      // Books
      'book.chapters': 'chapters',
      'book.read': 'Read',
      'book.vote': 'Vote',
      'book.directions': 'What happens next?',
      'book.characters': 'Characters',
      'book.applyCharacter': 'Apply Character',

      // Submit
      'submit.title': 'Submit New Novel',
      'submit.bookTitle': 'Novel Title',
      'submit.genre': 'Genre',
      'submit.worldview': 'World Setting',
      'submit.outline': 'Story Outline',
      'submit.conflict': 'Core Conflict',
      'submit.tone': 'Tone',
      'submit.characters': 'Characters',
      'submit.characterName': 'Character Name',
      'submit.appearance': 'Appearance',
      'submit.personality': 'Personality',
      'submit.motivation': 'Motivation',
      'submit.backstory': 'Backstory',
      'submit.submit': 'Submit',

      // Admin
      'admin.pending': 'Pending Review',
      'admin.approve': 'Approve',
      'admin.reject': 'Reject',
      'admin.aiReview': 'AI Review',
      'admin.aiSuggestion': 'AI Suggestion',

      // Moderation
      'mod.low': 'Low Risk',
      'mod.medium': 'Medium Risk',
      'mod.high': 'High Risk',
      'mod.approve': 'Approve',
      'mod.review': 'Needs Review',
      'mod.reject': 'Recommend Reject',

      // Common
      'common.loading': 'Loading...',
      'common.error': 'Error',
      'common.success': 'Success',
      'common.cancel': 'Cancel',
      'common.confirm': 'Confirm',
      'common.back': 'Back',
    },
  },
  zh: {
    translation: {
      'nav.home': '首页',
      'nav.books': '书库',
      'nav.submit': '投稿',
      'nav.profile': '我的',

      'auth.login': '登录',
      'auth.register': '注册',
      'auth.email': '邮箱',
      'auth.password': '密码',
      'auth.username': '用户名',
      'auth.logout': '退出',

      'home.title': 'AI 小说创作平台',
      'home.subtitle': '由读者投票驱动的 AI 小说创作',
      'home.latest': '最新连载',
      'home.empty': '暂无小说，去投稿创建第一本吧！',

      'book.chapters': '章',
      'book.read': '阅读',
      'book.vote': '投票',
      'book.directions': '接下来会怎样？',
      'book.characters': '角色',
      'book.applyCharacter': '申请角色入书',

      'submit.title': '投稿创建新书',
      'submit.bookTitle': '书名',
      'submit.genre': '类型',
      'submit.worldview': '世界观设定',
      'submit.outline': '故事大纲',
      'submit.conflict': '核心冲突',
      'submit.tone': '文风/基调',
      'submit.characters': '角色设定',
      'submit.characterName': '角色名',
      'submit.appearance': '外貌',
      'submit.personality': '性格',
      'submit.motivation': '动机',
      'submit.backstory': '背景故事',
      'submit.submit': '提交投稿',

      'admin.pending': '待审核',
      'admin.approve': '通过',
      'admin.reject': '拒绝',
      'admin.aiReview': 'AI 审核',
      'admin.aiSuggestion': 'AI 建议',

      'mod.low': '低风险',
      'mod.medium': '中风险',
      'mod.high': '高风险',
      'mod.approve': '建议通过',
      'mod.review': '建议复核',
      'mod.reject': '建议拒绝',

      'common.loading': '加载中...',
      'common.error': '错误',
      'common.success': '成功',
      'common.cancel': '取消',
      'common.confirm': '确认',
      'common.back': '返回',
    },
  },
};

i18n.use(initReactI18next).init({
  resources,
  lng: Localization.getLocales()[0]?.languageCode || 'zh',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
