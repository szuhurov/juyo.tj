import { translations } from "./translations";

/**
 * Функсия барои сохтани объекти тарҷумаи Clerk аз луғати асосии барнома.
 */
export const getClerkLocalization = (locale: string) => {
  const t = translations[locale]?.clerk || translations['tg'].clerk;

  return {
    signIn: {
      start: {
        title: t.signInTitle,
        subtitle: t.signInSubtitle,
        actionText: t.noAccount,
        actionLink: t.actionLinkSignUp,
      },
      password: {
        title: t.signInPasswordLabel,
      }
    },
    signUp: {
      start: {
        title: t.signUpTitle,
        subtitle: t.signUpSubtitle,
        actionText: t.haveAccount,
        actionLink: t.actionLinkSignIn,
      },
    },
    socialButtonsBlockButton: t.socialButton,
    dividerText: t.dividerText,
    formButtonPrimary: t.submitButton,
    formFieldLabel__emailAddress: t.emailLabel,
    formFieldLabel__password: t.signUpPasswordLabel, // Ин барои SignUp ҳамчун "Рамзи пурқувват..." мебарояд
    formFieldLabel__firstName: t.firstNameLabel,
    formFieldLabel__lastName: t.lastNameLabel,
    formFieldPlaceholder__emailAddress: t.emailLabel,
    formFieldPlaceholder__firstName: t.firstNameLabel,
    formFieldPlaceholder__lastName: t.lastNameLabel,
    formFieldPlaceholder__password: t.passwordPlaceholder,
    formFieldHintText__password: t.passwordHint,

    
    unstable__errors: {
      password_too_short: t.errors.passwordTooShort,
      form_identifier_not_found: t.errors.userNotFound,
      form_password_incorrect: t.errors.wrongPassword,
      form_identifier_exists: t.errors.emailExists,
    }
  };
};
