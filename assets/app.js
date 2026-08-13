const translations = {
  en: {
    "nav.models":"Motorcycles","nav.stock":"Available Stock","nav.about":"About","nav.dealer":"Lubumbashi Dealer","nav.contact":"Contact",
    "hero.eyebrow":"Showroom experience · Lubumbashi","hero.line1":"Move with","hero.lead":"Motorcycles made for everyday work, city movement and the roads of Katanga. Discover our Eagle and Super ranges in Lubumbashi.","hero.ctaPrimary":"Explore motorcycles","hero.ctaSecondary":"Visit the dealer","hero.metric1":"Core range","hero.metric2":"Core range","hero.metric3":"Local dealer","hero.visualLabel":"HUANGHE RANGE","hero.visualTitle":"Built to keep moving.","hero.badgeTop":"Dealer",
    "models.kicker":"THE RANGE","models.title":"Choose your Huanghe.","models.intro":"Wave 1 establishes the showroom around the two ranges confirmed for Lubumbashi. Exact specifications and dealer photography can be added without redesigning the site.","models.photoPending":"Dealer photography ready to add","models.available":"Lubumbashi range","models.eagleDesc":"A practical Huanghe range prepared for daily mobility and dependable use.","models.superDesc":"A Huanghe range focused on utility, presence and day-to-day reliability.","models.ask":"Ask about Eagle","models.askSuper":"Ask about Super","models.moreTitle":"More models can be added as stock arrives.","models.moreCopy":"The catalogue is component-based, so new motorcycles can be added without changing the page structure.",
    "band.tag":"HUANGHE HERITAGE","band.title":"Utility that works as hard as you do.",
    "story.kicker":"HUANGHE MOTORS","story.title":"A motorcycle name with history. A showroom built for Lubumbashi.","story.p1":"Huanghe traces its motorcycle brand history back decades in China. The Lubumbashi website presents that heritage through the motorcycles actually available from the local dealer.","story.p2":"For Wave 1, the site avoids inventing specifications for Eagle or Super. Those details will be populated from the dealer’s real inventory and documentation.","story.link":"Talk to the Lubumbashi dealer","story.featureLabel":"DESIGNED FOR","story.featureTitle":"Real roads. Real work. Real movement.",
    "dealer.kicker":"LUBUMBASHI","dealer.title":"See the motorcycles in person.","dealer.copy":"Contact Huanghe Motors Lubumbashi for current Eagle and Super availability, colours and dealer information.","dealer.email":"Contact details coming next","dealer.whatsappPending":"WhatsApp number coming next","dealer.note":"Wave 2 will add the confirmed address, map, telephone/WhatsApp and full dealer page."
  },
  fr: {
    "nav.models":"Motos","nav.stock":"Stock disponible","nav.about":"À propos","nav.dealer":"Concession Lubumbashi","nav.contact":"Contact",
    "hero.eyebrow":"Expérience showroom · Lubumbashi","hero.line1":"Avancez avec","hero.lead":"Des motos pensées pour le travail quotidien, les déplacements urbains et les routes du Katanga. Découvrez nos gammes Eagle et Super à Lubumbashi.","hero.ctaPrimary":"Découvrir les motos","hero.ctaSecondary":"Visiter la concession","hero.metric1":"Gamme principale","hero.metric2":"Gamme principale","hero.metric3":"Concession locale","hero.visualLabel":"GAMME HUANGHE","hero.visualTitle":"Conçue pour avancer.","hero.badgeTop":"Concession",
    "models.kicker":"LA GAMME","models.title":"Choisissez votre Huanghe.","models.intro":"La première vague construit le showroom autour des deux gammes confirmées à Lubumbashi. Les caractéristiques exactes et les photos de la concession pourront être ajoutées sans refaire le site.","models.photoPending":"Photos de la concession à ajouter","models.available":"Gamme Lubumbashi","models.eagleDesc":"Une gamme Huanghe pratique, pensée pour les déplacements quotidiens et un usage fiable.","models.superDesc":"Une gamme Huanghe axée sur l’utilité, la présence et la fiabilité au quotidien.","models.ask":"Demander Eagle","models.askSuper":"Demander Super","models.moreTitle":"D’autres modèles pourront être ajoutés selon les arrivages.","models.moreCopy":"Le catalogue est modulaire : de nouvelles motos peuvent être ajoutées sans modifier la structure de la page.",
    "band.tag":"HÉRITAGE HUANGHE","band.title":"Une utilité qui travaille aussi dur que vous.",
    "story.kicker":"HUANGHE MOTORS","story.title":"Un nom de moto avec une histoire. Un showroom conçu pour Lubumbashi.","story.p1":"La marque de motos Huanghe possède plusieurs décennies d’histoire en Chine. Le site de Lubumbashi présente cet héritage à travers les motos réellement proposées par la concession locale.","story.p2":"Pour cette première vague, le site n’invente aucune caractéristique pour Eagle ou Super. Ces données seront renseignées depuis le stock et les documents réels du concessionnaire.","story.link":"Contacter la concession de Lubumbashi","story.featureLabel":"PENSÉ POUR","story.featureTitle":"De vraies routes. Du vrai travail. Du mouvement.",
    "dealer.kicker":"LUBUMBASHI","dealer.title":"Venez voir les motos en personne.","dealer.copy":"Contactez Huanghe Motors Lubumbashi pour connaître la disponibilité actuelle des Eagle et Super, les couleurs et les informations de la concession.","dealer.email":"Coordonnées à venir","dealer.whatsappPending":"Numéro WhatsApp à venir","dealer.note":"La vague 2 ajoutera l’adresse confirmée, la carte, le téléphone/WhatsApp et la page complète de la concession."
  }
};

const header = document.querySelector('[data-header]');
const menuButton = document.querySelector('[data-menu-button]');
const mobileMenu = document.querySelector('[data-mobile-menu]');

function setLanguage(lang) {
  const dict = translations[lang] || translations.en;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const value = dict[el.dataset.i18n];
    if (value) el.textContent = value;
  });
  document.querySelectorAll('[data-lang]').forEach((button) => {
    const active = button.dataset.lang === lang;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  localStorage.setItem('huanghe-language', lang);
}

document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.lang)));
setLanguage(localStorage.getItem('huanghe-language') || 'en');

document.querySelector('[data-year]').textContent = new Date().getFullYear();

function onScroll() { header.classList.toggle('is-scrolled', window.scrollY > 12); }
onScroll();
window.addEventListener('scroll', onScroll, { passive: true });

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  mobileMenu.hidden = !open;
});
mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
  menuButton.setAttribute('aria-expanded', 'false');
  mobileMenu.hidden = true;
}));
