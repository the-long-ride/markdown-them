import type { LanguageCode } from './LanguageContext';

export interface SupportPromptTranslations {
  title: string;
  message: string;
  starTitle: string;
  starDesc: string;
  starButton: string;
  donateTitle: string;
  donateDesc: string;
  donateButton: string;
  thanks: string;
  maybeLater: string;
  dontShowAgain: string;
  close: string;
}

export const SUPPORT_PROMPT_TRANSLATIONS: Record<LanguageCode, SupportPromptTranslations> = {
  en: {
    title: 'Enjoying Markdown Them?',
    message:
      "Thanks for using Markdown Them! It's free, open source, and built with care. If it makes your work easier, here are two ways to cheer it on:",
    starTitle: 'Leave a star',
    starDesc: 'Free and takes a few seconds. It helps others discover the project.',
    starButton: 'Star on GitHub',
    donateTitle: 'Make a donation',
    donateDesc: 'Any amount helps keep new features and fixes coming.',
    donateButton: 'Donate',
    thanks: 'Either way, thank you for being here!',
    maybeLater: 'Maybe later',
    dontShowAgain: "Don't show this again",
    close: 'Close',
  },
  vi: {
    title: 'Bạn có thích Markdown Them không?',
    message:
      'Cảm ơn bạn đã sử dụng Markdown Them! Ứng dụng miễn phí, mã nguồn mở và được xây dựng tận tâm. Nếu nó giúp công việc của bạn nhẹ nhàng hơn, đây là hai cách để cổ vũ dự án:',
    starTitle: 'Tặng một ngôi sao',
    starDesc: 'Miễn phí và chỉ mất vài giây. Giúp nhiều người khác biết đến dự án.',
    starButton: 'Tặng sao trên GitHub',
    donateTitle: 'Ủng hộ tài chính',
    donateDesc: 'Mọi khoản ủng hộ đều giúp duy trì tính năng mới và các bản sửa lỗi.',
    donateButton: 'Ủng hộ',
    thanks: 'Dù thế nào, cảm ơn bạn đã luôn đồng hành!',
    maybeLater: 'Để sau',
    dontShowAgain: 'Không hiển thị lại',
    close: 'Đóng',
  },
  zh: {
    title: '喜欢 Markdown Them 吗？',
    message:
      '感谢使用 Markdown Them！它完全免费、开源，并用心打造。如果它让您的工作更加轻松，可以通过以下两种方式支持我们：',
    starTitle: '点亮一颗星',
    starDesc: '免费且只需几秒钟，帮助更多人发现这个项目。',
    starButton: '在 GitHub 上点星',
    donateTitle: '赞助项目',
    donateDesc: '任何支持都能帮助新功能和修复持续推出。',
    donateButton: '赞助',
    thanks: '无论如何，感谢您的支持与陪伴！',
    maybeLater: '以后再说',
    dontShowAgain: '不再显示',
    close: '关闭',
  },
  ja: {
    title: 'Markdown Them を気に入っていただけましたか？',
    message:
      'Markdown Them をご利用いただきありがとうございます！完全無料のオープンソースで、心を込めて開発しています。お役に立てているなら、次の2つの方法で応援していただけると嬉しいです：',
    starTitle: 'スターを付ける',
    starDesc: '無料で数秒で完了します。より多くの人がプロジェクトを見つけられるようになります。',
    starButton: 'GitHub でスター',
    donateTitle: '寄付する',
    donateDesc: '少額でも新機能の開発やバグ修正の継続に役立ちます。',
    donateButton: '寄付する',
    thanks: 'いずれにしても、ご利用いただきありがとうございます！',
    maybeLater: '後で',
    dontShowAgain: '今後このメッセージを表示しない',
    close: '閉じる',
  },
  no: {
    title: 'Liker du Markdown Them?',
    message:
      'Takk for at du bruker Markdown Them! Det er gratis, åpen kildekode og laget med omhu. Hvis det gjør arbeidet ditt enklere, er det to måter å støtte prosjektet på:',
    starTitle: 'Gi en stjerne',
    starDesc: 'Gratis og tar bare noen sekunder. Det hjelper andre å oppdage prosjektet.',
    starButton: 'Gi stjerne på GitHub',
    donateTitle: 'Gi en donasjon',
    donateDesc: 'Alle bidrag hjelper med å holde nye funksjoner og feilrettinger i gang.',
    donateButton: 'Doner',
    thanks: 'Uansett, takk for at du er her!',
    maybeLater: 'Kanskje senere',
    dontShowAgain: 'Ikke vis dette igjen',
    close: 'Lukk',
  },
  es: {
    title: '¿Te gusta Markdown Them?',
    message:
      '¡Gracias por usar Markdown Them! Es gratuito, de código abierto y desarrollado con esmero. Si te facilita el trabajo, aquí tienes dos formas de apoyarlo:',
    starTitle: 'Deja una estrella',
    starDesc: 'Es gratis y solo toma unos segundos. Ayuda a que otros descubran el proyecto.',
    starButton: 'Dar estrella en GitHub',
    donateTitle: 'Haz una donación',
    donateDesc: 'Cualquier cantidad ayuda a mantener nuevas funciones y mejoras.',
    donateButton: 'Donar',
    thanks: '¡En cualquier caso, gracias por estar aquí!',
    maybeLater: 'Quizás más tarde',
    dontShowAgain: 'No volver a mostrar',
    close: 'Cerrar',
  },
  fr: {
    title: 'Vous appréciez Markdown Them ?',
    message:
      "Merci d'utiliser Markdown Them ! C'est gratuit, open source et développé avec soin. Si cela facilite votre travail, voici deux façons de soutenir le projet :",
    starTitle: 'Laisser une étoile',
    starDesc: "Gratuit et rapide. Cela aide d'autres personnes à découvrir le projet.",
    starButton: 'Étoiler sur GitHub',
    donateTitle: 'Faire un don',
    donateDesc: 'Chaque montant aide à maintenir les nouvelles fonctionnalités et corrections.',
    donateButton: 'Faire un don',
    thanks: "Dans tous les cas, merci d'être là !",
    maybeLater: 'Plus tard',
    dontShowAgain: 'Ne plus afficher',
    close: 'Fermer',
  },
  ko: {
    title: 'Markdown Them이 마음에 드시나요?',
    message:
      'Markdown Them을 사용해 주셔서 감사합니다! 무료 오픈소스이며 정성껏 제작되었습니다. 작업에 도움이 되었다면 두 가지 방법으로 응원해 주세요:',
    starTitle: '스타 남기기',
    starDesc: '무료이며 몇 초면 충분합니다. 더 많은 사람이 프로젝트를 발견할 수 있게 돕습니다.',
    starButton: 'GitHub에서 스타 주기',
    donateTitle: '후원하기',
    donateDesc: '작은 후원이라도 새로운 기능과 오류 수정을 지속하는 데 큰 힘이 됩니다.',
    donateButton: '후원하기',
    thanks: '어떤 방법이든, 함께해 주셔서 진심으로 감사드립니다!',
    maybeLater: '나중에',
    dontShowAgain: '다시 표시하지 않음',
    close: '닫기',
  },
};

export function getSupportPromptTranslations(languageCode?: string): SupportPromptTranslations {
  if (languageCode && languageCode in SUPPORT_PROMPT_TRANSLATIONS) {
    return SUPPORT_PROMPT_TRANSLATIONS[languageCode as LanguageCode];
  }
  return SUPPORT_PROMPT_TRANSLATIONS.en;
}
