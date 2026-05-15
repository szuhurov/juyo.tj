import { translations } from "./translations";
import { ruRU, enUS } from "@clerk/localizations";

/**
 * Функсия барои сохтани объекти тарҷумаи Clerk аз луғати асосии барнома.
 */
export const getClerkLocalization = (locale: string) => {
  // Агар забон русӣ бошад, аз тарҷумаи расмии Clerk истифода мебарем
  if (locale === 'ru') {
    const t = translations['ru'].clerk;
    return {
      ...ruRU,
      signIn: {
        ...ruRU.signIn,
        password: {
          ...ruRU.signIn?.password,
          subtitle: t.signInPasswordSubtitle,
        }
      }
    };
  }
  
  // Агар забон англисӣ бошад, аз тарҷумаи расмии Clerk истифода мебарем
  if (locale === 'en') {
    const t = translations['en'].clerk;
    return {
      ...enUS,
      signIn: {
        ...enUS.signIn,
        password: {
          ...enUS.signIn?.password,
          subtitle: t.signInPasswordSubtitle,
        }
      }
    };
  }

  // Барои забони тоҷикӣ тарҷумаи худамонро истифода мебарем
  const t = translations[locale]?.clerk || translations['tg'].clerk;

  return {
    signUp: {
      start: {
        title: t.signUpTitle,
        subtitle: t.signUpSubtitle,
        actionText: t.haveAccount,
        actionLink: t.actionLinkSignIn,
      },
      emailCode: {
        title: t.verifyEmailTitle,
        subtitle: t.verifyEmailSubtitle,
        actionText: t.resendCode,
        resendButton: t.resendCode,
      },
      password: {
        title: t.signUpPasswordLabel,
        subtitle: t.passwordHint,
        placeholder: t.signUpPasswordPlaceholder,
        successText: t.passwordSuccess,
        requirement__minCharacters: t.passwordRequirementMinCharacters,
        requirement__lowercase: t.passwordRequirementLowercase,
        requirement__uppercase: t.passwordRequirementUppercase,
        requirement__number: t.passwordRequirementNumber,
        requirement__specialCharacter: t.passwordRequirementSpecialCharacter,
      }
    },
    signIn: {
      start: {
        title: t.signInTitle,
        subtitle: t.signInSubtitle,
        actionText: t.noAccount,
        actionLink: t.actionLinkSignUp,
      },
      password: {
        title: t.signInPasswordLabel,
        subtitle: t.signInPasswordSubtitle,
        placeholder: t.signInPasswordPlaceholder,
        actionLink: t.useAnotherMethod,
        footerActionLink: t.forgotPasswordLabel,
        actionText: 'Аввал сабти ном кунед',
        signUpLink: t.actionLinkSignUp,
      },
      emailCode: {
        title: t.verifyEmailTitle,
        subtitle: t.verifyEmailSubtitle,
        actionText: t.resendCode,
        resendButton: t.resendCode,
      }
    },
    forgotPassword: {
      start: {
        title: t.forgotPass?.emailTitle || 'Барқарори рамз',
        subtitle: t.forgotPass?.emailSub || 'Почтаи электронии худро ворид кунед ва мо ба шумо дастурҳоро мефиристем.',
        actionText: t.alreadyHaveAccount || 'Аллакай ҳисоб доред?',
        actionLink: t.actionLinkSignIn || 'Ворид шавед',
      },
      email_address: {
        title: t.forgotPass?.emailTitle || 'Барқарори рамз',
        subtitle: t.forgotPass?.emailSub || 'Почтаи электронии худро ворид кунед ва мо ба шумо дастурҳоро мефиристем.',
        actionText: t.alreadyHaveAccount || 'Аллакай ҳисоб доред?',
        actionLink: t.actionLinkSignIn || 'Ворид шавед',
      }
    },
    socialButtonsBlockButton: t.socialButton,
    dividerText: t.dividerText,
    formButtonPrimary: t.submitButton,
    formFieldLabel__emailAddress: t.emailLabel,
    formFieldLabel__password: t.signInPasswordLabel,
    formFieldLabel__firstName: t.firstNameLabel,
    formFieldLabel__lastName: t.lastNameLabel,
    // Ҳам 'Placeholder' ва ҳам 'InputPlaceholder'-ро илова мекунем барои боварӣ
    formFieldPlaceholder__emailAddress: t.emailLabel,
    formFieldPlaceholder__firstName: t.firstNameLabel,
    formFieldPlaceholder__lastName: t.lastNameLabel,
    formFieldPlaceholder__password: t.signInPasswordPlaceholder,
    formFieldInputPlaceholder__emailAddress: t.emailLabel,
    formFieldInputPlaceholder__firstName: t.firstNameLabel,
    formFieldInputPlaceholder__lastName: t.lastNameLabel,
    formFieldInputPlaceholder__password: t.signInPasswordPlaceholder,
    formFieldHintText__password: t.passwordHint,
    formFieldSuccessText__password: t.passwordSuccess,

    unstable__errors: {
      password_too_short: t.errors.passwordTooShort,
      password_pwned: t.passwordPwned,
      form_identifier_not_found: t.errors.userNotFound,
      form_password_incorrect: t.errors.wrongPassword,
      form_identifier_exists: t.errors.emailExists,
      form_code_incorrect: t.errors.incorrectCode,
      rate_limit_exceeded: t.errors.tooManyRequests,
    }
  };
};
