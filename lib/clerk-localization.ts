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
          actionLink: t.useAnotherMethod,
        },
        alternativeMethods: {
          ...ruRU.signIn?.alternativeMethods,
          title: t.alternativeMethodsTitle,
          subtitle: t.alternativeMethodsSubtitle,
          blockButton: t.useAnotherMethod,
          blockButton__emailCode: t.alternativeMethodsEmailCodeButton,
          blockButton__emailLink: t.alternativeMethodsEmailLinkButton,
          blockButton__smsCode: t.alternativeMethodsSmsCodeButton,
          actionText: t.alternativeMethodsGetHelpTitle,
          actionLink: t.alternativeMethodsGetHelpLink,
        },
        emailCode: {
          ...ruRU.signIn?.emailCode,
          title: t.verifyEmailTitle,
          subtitle: t.verifyEmailSubtitle,
          actionLink: t.useAnotherMethod,
        },
        phoneCode: {
          ...ruRU.signIn?.phoneCode,
          actionLink: t.useAnotherMethod,
        },
        forgotPasswordAlternativeMethods: {
          ...ruRU.signIn?.forgotPasswordAlternativeMethods,
          label__alternativeMethods: 'Или, войдите другим способом',
          title: t.forgotPasswordLabel,
        },
        resetPassword: {
          ...ruRU.signIn?.resetPassword,
          title: t.resetPasswordTitle,
          formButtonPrimary: t.resetPasswordButton,
        },
      },
      signUp: {
        ...ruRU.signUp,
        emailCode: {
          ...ruRU.signUp?.emailCode,
          title: t.verifyEmailTitle,
          subtitle: t.verifyEmailSubtitle,
          actionLink: t.useAnotherMethod,
        },
        phoneCode: {
          ...ruRU.signUp?.phoneCode,
          actionLink: t.useAnotherMethod,
        }
      },
      verification: {
        ...ruRU.verification,
        email_code: {
          title: t.verifyEmailTitle,
          subtitle: t.verifyEmailSubtitle,
          actionLink: t.useAnotherMethod,
        },
        phone_code: {
          actionLink: t.useAnotherMethod,
        }
      },
      userButton: {
        ...ruRU.userButton,
        action__signOut: translations['ru'].signOut,
        action__manageAccount: translations['ru'].manageAccount,
      },
      formFieldAction__forgotPassword: t.forgotPasswordLabel,
      formFieldLabel__newPassword: t.newPasswordLabel,
      formFieldLabel__confirmPassword: t.confirmPasswordLabel,
      formFieldLabel__signOutOfOtherSessions: t.signOutOfOtherSessionsLabel,
      footerActionLink__useAnotherMethod: t.useAnotherMethod,
      backButton: t.alternativeMethodsBack,
      footerActionLink: t.alternativeMethodsGetHelpLink,
      footerActionText: t.alternativeMethodsGetHelpTitle,
      brandedText: t.securedBy,
      lastAuthenticationStrategy: t.lastUsed,
      
      formFieldError__notMatchingPasswords: t.passwordMismatch,
      
      membershipRequirement: {
        ...ruRU.membershipRequirement,
        minimumLength: t.passwordRequirementMinCharacters,
        sentencePrefix: t.passwordRequirementPrefix,
      },

      zxcvbn: {
        ...ruRU.zxcvbn,
        goodPassword: t.passwordRequirementsMet,
        excellentPassword: t.passwordExcellent,
      },

      unstable__errors: {
        password_too_short: t.errors.passwordTooShort,
        password_pwned: t.passwordPwned,
        form_identifier_not_found: t.errors.userNotFound,
        form_password_incorrect: t.errors.wrongPassword,
        form_identifier_exists: t.errors.emailExists,
        form_code_incorrect: t.errors.incorrectCode,
        rate_limit_exceeded: t.errors.tooManyRequests,
      },
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
          actionLink: t.useAnotherMethod,
        },
        alternativeMethods: {
          ...enUS.signIn?.alternativeMethods,
          title: t.alternativeMethodsTitle,
          subtitle: t.alternativeMethodsSubtitle,
          blockButton: t.useAnotherMethod,
          blockButton__emailCode: t.alternativeMethodsEmailCodeButton,
          blockButton__emailLink: t.alternativeMethodsEmailLinkButton,
          blockButton__smsCode: t.alternativeMethodsSmsCodeButton,
          actionText: t.alternativeMethodsGetHelpTitle,
          actionLink: t.alternativeMethodsGetHelpLink,
        },
        emailCode: {
          ...enUS.signIn?.emailCode,
          title: t.verifyEmailTitle,
          subtitle: t.verifyEmailSubtitle,
          actionLink: t.useAnotherMethod,
        },
        phoneCode: {
          ...enUS.signIn?.phoneCode,
          actionLink: t.useAnotherMethod,
        },
        forgotPasswordAlternativeMethods: {
          ...enUS.signIn?.forgotPasswordAlternativeMethods,
          label__alternativeMethods: t.alternativeMethodsTitle,
          title: t.forgotPasswordLabel,
        },
        resetPassword: {
          ...enUS.signIn?.resetPassword,
          title: t.resetPasswordTitle,
          formButtonPrimary: t.resetPasswordButton,
        },
      },
      signUp: {
        ...enUS.signUp,
        emailCode: {
          ...enUS.signUp?.emailCode,
          title: t.verifyEmailTitle,
          subtitle: t.verifyEmailSubtitle,
          actionLink: t.useAnotherMethod,
        },
        phoneCode: {
          ...enUS.signUp?.phoneCode,
          actionLink: t.useAnotherMethod,
        }
      },
      verification: {
        ...enUS.verification,
        email_code: {
          title: t.verifyEmailTitle,
          subtitle: t.verifyEmailSubtitle,
          actionLink: t.useAnotherMethod,
        },
        phone_code: {
          actionLink: t.useAnotherMethod,
        }
      },
      formFieldAction__forgotPassword: t.forgotPasswordLabel,
      formFieldLabel__newPassword: t.newPasswordLabel,
      formFieldLabel__confirmPassword: t.confirmPasswordLabel,
      formFieldLabel__signOutOfOtherSessions: t.signOutOfOtherSessionsLabel,
      footerActionLink__useAnotherMethod: t.useAnotherMethod,
      backButton: t.alternativeMethodsBack,
      footerActionLink: t.alternativeMethodsGetHelpLink,
      footerActionText: t.alternativeMethodsGetHelpTitle,
      brandedText: t.securedBy,
      lastAuthenticationStrategy: t.lastUsed,

      formFieldError__notMatchingPasswords: t.passwordMismatch,

      membershipRequirement: {
        minimumLength: t.passwordRequirementMinCharacters,
        sentencePrefix: t.passwordRequirementPrefix,
      },

      zxcvbn: {
        goodPassword: t.passwordRequirementsMet,
        excellentPassword: t.passwordExcellent,
      },

      unstable__errors: {
        password_too_short: t.errors.passwordTooShort,
        password_pwned: t.passwordPwned,
        form_identifier_not_found: t.errors.userNotFound,
        form_password_incorrect: t.errors.wrongPassword,
        form_identifier_exists: t.errors.emailExists,
        form_code_incorrect: t.errors.incorrectCode,
        rate_limit_exceeded: t.errors.tooManyRequests,
      },
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
        actionLink: t.useAnotherMethod,
      },
      phoneCode: {
        actionLink: t.useAnotherMethod,
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
      alternativeMethods: {
        title: t.alternativeMethodsTitle,
        subtitle: t.alternativeMethodsSubtitle,
        blockButton: t.useAnotherMethod,
        blockButton__emailCode: t.alternativeMethodsEmailCodeButton,
        blockButton__emailLink: t.alternativeMethodsEmailLinkButton,
        blockButton__smsCode: t.alternativeMethodsSmsCodeButton,
        actionText: t.alternativeMethodsGetHelpTitle,
        actionLink: t.alternativeMethodsGetHelpLink,
      },
      emailCode: {
        title: t.verifyEmailTitle,
        subtitle: t.verifyEmailSubtitle,
        actionText: t.resendCode,
        resendButton: t.resendCode,
        actionLink: t.useAnotherMethod,
      },
      phoneCode: {
        actionLink: t.useAnotherMethod,
      },
      forgotPassword: {
        title: t.forgotPasswordLabel || 'Рамзро фаромӯш кардед?',
        subtitle: 'барои барқарор кардани рамзи шумо',
        formTitle: 'Коди барқарори рамз',
        resendButton: 'Кодро нагирифтед? Дубора фиристодан',
        subtitle_email: 'Аввал кодеро,ки ба почтаи электронии шумо фиристода шуд, ворид кунед',
        subtitle_phone: 'Аввал кодеро, ки ба телефони шумо фиристода шуд, ворид кунед',
      },
      forgotPasswordAlternativeMethods: {
        title: t.forgotPasswordLabel || 'Рамзро фаромӯш кардед?',
        label__alternativeMethods: 'Ё, бо усули дигар ворид шавед',
        blockButton__resetPassword: 'Барқарор кардани рамз',
      },
      resetPassword: {
        title: t.resetPasswordTitle,
        formButtonPrimary: t.resetPasswordButton,
      }
    },
    verification: {
      email_code: {
        title: t.verifyEmailTitle,
        subtitle: t.verifyEmailSubtitle,
        actionLink: t.useAnotherMethod,
      },
      phone_code: {
        actionLink: t.useAnotherMethod,
      }
    },
    socialButtonsBlockButton: t.socialButton,
    dividerText: t.dividerText,
    formButtonPrimary: t.submitButton,
    formFieldLabel__emailAddress: t.emailLabel,
    formFieldLabel__password: t.signInPasswordLabel,
    formFieldLabel__firstName: t.firstNameLabel,
    formFieldLabel__lastName: t.lastNameLabel,
    formFieldLabel__newPassword: t.newPasswordLabel,
    formFieldLabel__confirmPassword: t.confirmPasswordLabel,
    formFieldLabel__signOutOfOtherSessions: t.signOutOfOtherSessionsLabel,
    // Ҳам 'Placeholder' ва ҳам 'InputPlaceholder'-ро илова мекунем барои боварӣ
    formFieldPlaceholder__emailAddress: t.emailLabel,
    formFieldPlaceholder__firstName: t.firstNameLabel,
    formFieldPlaceholder__lastName: t.lastNameLabel,
    formFieldPlaceholder__password: t.signInPasswordPlaceholder,
    formFieldInputPlaceholder__emailAddress: t.emailLabel,
    formFieldInputPlaceholder__firstName: t.firstNameLabel,
    formFieldInputPlaceholder__lastName: t.lastNameLabel,
    formFieldInputPlaceholder__password: t.signInPasswordPlaceholder,
    // Махсус барои Sign Up, агар Clerk инҳоро истифода барад
    formFieldLabel__createPassword: t.signUpPasswordLabel,
    formFieldInputPlaceholder__createPassword: t.signUpPasswordPlaceholder,
    formFieldPlaceholder__signUpPassword: t.signUpPasswordPlaceholder,
    formFieldInputPlaceholder__signUpPassword: t.signUpPasswordPlaceholder,
    formFieldHintText__password: t.passwordHint,
    formFieldSuccessText__password: t.passwordSuccess,
    formFieldAction__forgotPassword: t.forgotPasswordLabel,

    formFieldError__notMatchingPasswords: t.passwordMismatch,

    footerActionLink__useAnotherMethod: t.useAnotherMethod,
    backButton: t.alternativeMethodsBack,
    footerActionLink: t.alternativeMethodsGetHelpLink,
    footerActionText: t.alternativeMethodsGetHelpTitle,
    brandedText: t.securedBy,
    lastAuthenticationStrategy: t.lastUsed,

    unstable__errors: {
      password_too_short: t.errors.passwordTooShort,
      password_pwned: t.passwordPwned,
      form_identifier_not_found: t.errors.userNotFound,
      form_password_incorrect: t.errors.wrongPassword,
      form_identifier_exists: t.errors.emailExists,
      form_code_incorrect: t.errors.incorrectCode,
      rate_limit_exceeded: t.errors.tooManyRequests,
    },
    
    membershipRequirement: {
      minimumLength: t.passwordRequirementMinCharacters,
      sentencePrefix: t.passwordRequirementPrefix,
    },

    zxcvbn: {
      goodPassword: t.passwordRequirementsMet,
      excellentPassword: t.passwordExcellent,
    }
  };
};
