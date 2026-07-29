/**
 * Dictionnaire de traduction & localisation pour le module Progression Manager.
 */

const translations = {
  fr: {
    MODULE_TITLE: "Progression Manager",
    NO_TEAMS: "Aucune équipe enregistrée sur ce serveur.",
    TEAM_STATUS_OPEN: "🟢 Ouvert",
    TEAM_STATUS_CLOSED: "🔴 Fermé",
    TEAM_STATUS_SUSPENDED: "🟡 Suspendu",
    SUBMISSION_SUCCESS: "Votre déclaration de production a été envoyée au staff pour validation !",
    SUBMISSION_APPROVED_USER: "🎉 Votre déclaration de production de **{quantity} {item}** pour l'équipe **{team}** a été **validée** !",
    SUBMISSION_REJECTED_USER: "❌ Votre déclaration de production pour l'équipe **{team}** a été **refusée**.\nRaison: {reason}",
    VALIDATION_APPROVED_STAFF: "✅ Production validée par {staff}",
    VALIDATION_REJECTED_STAFF: "❌ Production refusée par {staff}\nRaison: {reason}",
    ERROR_NO_PROOF: "Vous devez impérativement joindre une capture d'écran comme preuve !",
    ERROR_TEAM_CLOSED: "Cette équipe est actuellement fermée ou suspendue.",
    ERROR_NOT_MEMBER: "Vous ne faites pas partie de cette équipe !",
    PERMISSION_DENIED: "Vous n'avez pas la permission d'effectuer cette action.",
  },
  en: {
    MODULE_TITLE: "Progression Manager",
    NO_TEAMS: "No teams configured on this server.",
    TEAM_STATUS_OPEN: "🟢 Open",
    TEAM_STATUS_CLOSED: "🔴 Closed",
    TEAM_STATUS_SUSPENDED: "🟡 Suspended",
    SUBMISSION_SUCCESS: "Your production report has been sent to staff for validation!",
    SUBMISSION_APPROVED_USER: "🎉 Your production of **{quantity} {item}** for team **{team}** has been **approved**!",
    SUBMISSION_REJECTED_USER: "❌ Your production for team **{team}** was **rejected**.\nReason: {reason}",
    VALIDATION_APPROVED_STAFF: "✅ Production approved by {staff}",
    VALIDATION_REJECTED_STAFF: "❌ Production rejected by {staff}\nReason: {reason}",
    ERROR_NO_PROOF: "You must attach a screenshot proof!",
    ERROR_TEAM_CLOSED: "This team is currently closed or suspended.",
    ERROR_NOT_MEMBER: "You are not a member of this team!",
    PERMISSION_DENIED: "You do not have permission to execute this action.",
  },
};

function t(key, lang = "fr", params = {}) {
  const dict = translations[lang] || translations.fr;
  let text = dict[key] || translations.fr[key] || key;

  for (const [pKey, pVal] of Object.entries(params)) {
    text = text.replace(new RegExp(`\\{${pKey}\\}`, "g"), pVal);
  }

  return text;
}

module.exports = {
  t,
  translations,
};
