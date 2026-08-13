(() => {
  const lang = () => localStorage.getItem('huanghe-language') === 'fr' ? 'fr' : 'en';
  const copy = {
    en: { ask:'Request price', whatsapp:'WhatsApp', title:'Ask Huanghe Motors', intro:'Tell us which motorcycle you are interested in. The Lubumbashi dealer can follow up with current availability and price.', name:'Name', phone:'Phone / WhatsApp', email:'Email (optional)', city:'City (optional)', model:'Motorcycle', message:'Message (optional)', send:'Send inquiry', sending:'Sending…', sent:'Inquiry sent. The dealer can follow up with you.', error:'Could not send the inquiry. Please try again.', close:'Close', inquire:'Ask dealer', in_stock:'In stock', low_stock:'Low stock', out_of_stock:'Out of stock', coming_soon:'Coming soon', qty:'available' },
    fr: { ask:'Demander le prix', whatsapp:'WhatsApp', title:'Contacter Huanghe Motors', intro:'Indiquez la moto qui vous intéresse. La concession de Lubumbashi pourra vous répondre avec la disponibilité et le prix actuels.', name:'Nom', phone:'Téléphone / WhatsApp', email:'E-mail (facultatif)', city:'Ville (facultatif)', model:'Moto', message:'Message (facultatif)', send:'Envoyer la demande', sending:'Envoi…', sent:'Demande envoyée. La concession pourra vous recontacter.', error:'Impossible d’envoyer la demande. Veuillez réessayer.', close:'Fermer', inquire:'Contacter la concession', in_stock:'En stock', low_stock:'Stock limité', out_of_stock:'Rupture de stock', coming_soon:'Bientôt disponible', qty:'disponibles' }
  };
  const state = { settings:{}, stock:new Map(), models:[], startedAt:Date.now() };
  let modal;

  async function boot() {
    try {
      const [settings, stock, models] = await Promise.all([
        fetch('/api/public/contact-settings').then(r=>r.ok?r.json():{}),
        fetch('/api/public/stock').then(r=>r.ok?r.json():{models:[]}),
        fetch('/api/public/models').then(r=>r.ok?r.json():{models:[]}),
      ]);
      state.settings=settings||{}; state.models=models.models||[];
      for (const item of stock.models||[]) state.stock.set(item.slug,item);
    } catch {}
    buildDock();
    updateStockBadge();
    document.addEventListener('click', interceptContactLinks);
    document.addEventListener('huanghe:language', refreshText);
  }

  function currentModel() {
    const page=document.body.dataset.page;
    if (page && !['dealership'].includes(page)) return page;
    const q=new URLSearchParams(location.search).get('model');
    if (q) return q;
    return '';
  }
  function modelName(slug){return state.models.find(m=>m.slug===slug)?.name || (slug?slug.replace(/(^|-)(\w)/g,(_,a,b)=>`${a}${b.toUpperCase()}`):'');}

  function buildDock() {
    if (document.querySelector('[data-wave4-dock]')) return;
    const dock=document.createElement('div');dock.className='w4-dock';dock.dataset.wave4Dock='';
    const stock=document.createElement('span');stock.className='w4-stock';stock.dataset.wave4Stock='';
    const ask=document.createElement('button');ask.type='button';ask.className='w4-ask';ask.dataset.wave4Ask='';ask.addEventListener('click',()=>openModal(currentModel()));
    const wa=document.createElement('a');wa.className='w4-wa';wa.target='_blank';wa.rel='noopener';wa.dataset.wave4Whatsapp='';
    dock.append(stock,ask,wa);document.body.append(dock);refreshText();
  }

  function refreshText(){
    const c=copy[lang()];const ask=document.querySelector('[data-wave4-ask]');if(ask)ask.textContent=c.ask;
    const wa=document.querySelector('[data-wave4-whatsapp]');if(wa){wa.textContent=c.whatsapp;const href=whatsappHref(currentModel());if(href){wa.href=href;wa.hidden=false}else wa.hidden=true;}
    updateStockBadge(); if(modal) updateModalLanguage();
  }
  function updateStockBadge(){
    const el=document.querySelector('[data-wave4-stock]');if(!el)return;const slug=currentModel(), s=state.stock.get(slug);if(!slug||!s){el.hidden=true;return;}el.hidden=false;const c=copy[lang()], label=c[s.availability]||c.inquire;el.textContent=s.quantity===null||s.quantity===undefined?label:`${label} · ${s.quantity} ${c.qty}`;el.dataset.status=s.availability||'inquire';
  }
  function whatsappHref(slug){const n=String(state.settings.whatsapp_number||'').replace(/\D/g,'');if(!n)return'';const name=modelName(slug);const msg=lang()==='fr'?(name?`Bonjour Huanghe Motors, je suis intéressé(e) par la moto ${name}.`:'Bonjour Huanghe Motors, je souhaite obtenir des informations sur vos motos.'):(name?`Hello Huanghe Motors, I'm interested in the ${name} motorcycle.`:`Hello Huanghe Motors, I'm interested in your motorcycles.`);return `https://wa.me/${n}?text=${encodeURIComponent(msg)}`;}
  function interceptContactLinks(event){const a=event.target.closest('a');if(!a)return;const t=(a.textContent||'').toLowerCase();if(!/ask|contact dealer|demander|contacter/.test(t))return;if(a.hostname&&a.hostname!==location.hostname)return; if(a.pathname.endsWith('dealership.html')){event.preventDefault();openModal(currentModel());}}

  function ensureModal(){
    if(modal)return modal;modal=document.createElement('div');modal.className='w4-modal';modal.hidden=true;modal.innerHTML=`<div class="w4-backdrop" data-w4-close></div><section class="w4-dialog" role="dialog" aria-modal="true" aria-labelledby="w4-title"><button class="w4-x" type="button" data-w4-close aria-label="Close">×</button><span class="w4-kicker">HUANGHE MOTORS · LUBUMBASHI</span><h2 id="w4-title"></h2><p data-w4-intro></p><form data-w4-form><input type="text" name="website" tabindex="-1" autocomplete="off" class="w4-honey"><div class="w4-fields"><label><span data-w4-label="name"></span><input name="name" maxlength="100" required></label><label><span data-w4-label="phone"></span><input name="phone" maxlength="50" inputmode="tel" required></label><label><span data-w4-label="email"></span><input name="email" maxlength="160" type="email"></label><label><span data-w4-label="city"></span><input name="city" maxlength="100"></label><label class="w4-full"><span data-w4-label="model"></span><select name="model_slug"></select></label><label class="w4-full"><span data-w4-label="message"></span><textarea name="message" maxlength="1500" rows="4"></textarea></label></div><div class="w4-form-actions"><button class="w4-submit" type="submit"></button><a class="w4-wa-inline" target="_blank" rel="noopener" data-w4-inline-wa></a></div><p class="w4-result" data-w4-result aria-live="polite"></p></form></section>`;
    document.body.append(modal);modal.querySelectorAll('[data-w4-close]').forEach(x=>x.addEventListener('click',closeModal));modal.querySelector('[data-w4-form]').addEventListener('submit',submitLead);modal.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});return modal;
  }
  function openModal(slug=''){const m=ensureModal();const select=m.querySelector('select[name=model_slug]');select.replaceChildren(new Option(lang()==='fr'?'Choisir une moto':'Choose a motorcycle',''));for(const item of state.models)select.add(new Option(item.name,item.slug));select.value=state.models.some(x=>x.slug===slug)?slug:'';m.hidden=false;document.documentElement.classList.add('w4-open');updateModalLanguage();m.querySelector('input[name=name]').focus();}
  function closeModal(){if(!modal)return;modal.hidden=true;document.documentElement.classList.remove('w4-open')}
  function updateModalLanguage(){if(!modal)return;const c=copy[lang()];modal.querySelector('#w4-title').textContent=c.title;modal.querySelector('[data-w4-intro]').textContent=c.intro;for(const el of modal.querySelectorAll('[data-w4-label]'))el.textContent=c[el.dataset.w4Label];modal.querySelector('.w4-submit').textContent=c.send;const wa=modal.querySelector('[data-w4-inline-wa]'),href=whatsappHref(modal.querySelector('select[name=model_slug]').value||currentModel());wa.textContent=c.whatsapp;if(href){wa.href=href;wa.hidden=false}else wa.hidden=true;}
  async function submitLead(event){event.preventDefault();const form=event.currentTarget,c=copy[lang()],result=form.querySelector('[data-w4-result]'),button=form.querySelector('.w4-submit'),fd=new FormData(form);button.disabled=true;button.textContent=c.sending;result.textContent='';try{const res=await fetch('/api/public/leads',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:fd.get('name'),phone:fd.get('phone'),email:fd.get('email'),city:fd.get('city'),model_slug:fd.get('model_slug'),message:fd.get('message'),website:fd.get('website'),language:lang(),started_at:state.startedAt})});const data=await res.json().catch(()=>({}));if(!res.ok)throw new Error(data.error||c.error);result.textContent=c.sent;form.reset();state.startedAt=Date.now();}catch(error){result.textContent=error.message||c.error}finally{button.disabled=false;button.textContent=c.send;}}
  document.addEventListener('change',e=>{if(e.target.matches('[data-w4-form] select[name=model_slug]'))updateModalLanguage()});
  boot();
})();
