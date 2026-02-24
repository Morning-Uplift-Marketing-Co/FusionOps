/**
 * Form Blocks
 * All forms use the LeadsGate + Voluum + gtag tracking stack
 * per Tracking & Conversion.md spec
 */

// ─── LeadsGateEmbed ─────────────────────────────────────────
// Standard LeadsGate embed — primary form for all LP types
export function LeadsGateEmbed(site, theme) {
  return `
  <div class="b-form b-form--lg-embed" id="form-anchor">
    <div class="b-form__header">
      <div class="b-form__title">${site.formTitle || 'Check Your Rate'}</div>
      <div class="b-form__sub">Free · No credit impact · 2 minutes</div>
    </div>
    <div id="lg-form-wrap"></div>
    <script src="https://leadsgate.com/form.js"><\/script>
    <script>
    (function(){
      var clickid = new URLSearchParams(location.search).get('clickid')||'';
      var formStarted=false;
      function fireFormStart(){
        if(formStarted)return; formStarted=true;
        if(typeof gtag==='function') gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formStartLabel||'FORM_START'}'});
        if(typeof pixel==='function') pixel('fl',{clickid:clickid});
      }
      window._lg_form_init_={
        aid:'${site.aid||'AID_PLACEHOLDER'}',
        template:'fresh',
        click_id:clickid,
        onFormLoad:function(){ fireFormStart(); },
        onStepChange:function(step){ if(typeof pixel==='function') pixel('step',{step:step,clickid:clickid}); },
        onSubmit:function(){
          if(typeof gtag==='function') gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formSubmitLabel||'FORM_SUBMIT'}'});
          if(typeof pixel==='function') pixel('fs',{clickid:clickid});
        },
        onSuccess:function(r){
          if(typeof pixel==='function') pixel('success',{clickid:clickid,lead_id:r&&r.lead_id?r.lead_id:''});
        }
      };
    })();
    <\/script>
  </div>`;
}

// ─── LeadsGateCompact ────────────────────────────────────────
// Slim horizontal version — fits inside HeroSplit right column
export function LeadsGateCompact(site, theme) {
  return `
  <div class="b-form b-form--compact" id="form-anchor">
    <div class="b-form__label">Get your rate — no credit impact</div>
    <div id="lg-form-wrap"></div>
    <script src="https://leadsgate.com/form.js"><\/script>
    <script>
    (function(){
      var clickid=new URLSearchParams(location.search).get('clickid')||'';
      var started=false;
      function fireStart(){if(started)return;started=true;if(typeof gtag==='function')gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formStartLabel||'FORM_START'}'});}
      window._lg_form_init_={
        aid:'${site.aid||'AID_PLACEHOLDER'}',template:'fresh',click_id:clickid,
        onFormLoad:fireStart,
        onStepChange:function(s){if(typeof pixel==='function')pixel('step',{step:s});},
        onSubmit:function(){if(typeof gtag==='function')gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formSubmitLabel||'FORM_SUBMIT'}'});},
        onSuccess:function(r){if(typeof pixel==='function')pixel('success',{lead_id:r&&r.lead_id?r.lead_id:''});}
      };
    })();
    <\/script>
  </div>`;
}

// ─── ZipGateForm ─────────────────────────────────────────────
// ZIP-first micro form → redirects to LeadsGate via Voluum
export function ZipGateForm(site, theme) {
  return `
  <div class="b-form b-form--zipgate" id="form-anchor">
    <div class="b-form__header">
      <div class="b-form__title">Check Rates In Your Area</div>
    </div>
    <div class="b-form__row">
      <input class="b-form__input b-form__input--zip" type="text"
        id="zip-input" inputmode="numeric" maxlength="5"
        placeholder="Enter ZIP Code" aria-label="ZIP Code">
      <button class="b-btn b-btn--primary b-btn--form" id="zip-submit">${site.cta}</button>
    </div>
    <p class="b-form__note">By continuing you agree to our <a href="/privacy">Privacy Policy</a> & <a href="/terms">Terms</a>.</p>
    <script>
    (function(){
      var clickid=new URLSearchParams(location.search).get('clickid')||'';
      var started=false;
      var zip=document.getElementById('zip-input');
      var btn=document.getElementById('zip-submit');
      if(zip){
        zip.addEventListener('focus',function(){
          if(started)return;started=true;
          if(typeof gtag==='function')gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formStartLabel||'FORM_START'}'});
          if(typeof pixel==='function')pixel('fl');
        });
        zip.addEventListener('input',function(){
          this.value=this.value.replace(/\\D/g,'').slice(0,5);
          if(this.value.length===5&&typeof pixel==='function')pixel('ze',{zip:this.value});
        });
      }
      if(btn){
        btn.addEventListener('click',function(){
          var z=zip?zip.value.trim():'';
          if(z.length!==5){if(zip)zip.focus();return;}
          if(typeof gtag==='function')gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formSubmitLabel||'FORM_SUBMIT'}'});
          if(typeof pixel==='function')pixel('fs',{zip:z,clickid:clickid});
          var url='${site.voluumClickUrl||'#'}'+(clickid?'?clickid='+clickid:'')+'&zip='+z;
          setTimeout(function(){window.location.href=url;},150);
        });
      }
    })();
    <\/script>
  </div>`;
}

// ─── AmountSliderForm ────────────────────────────────────────
// Amount + ZIP front page form with micro-conv tracking
export function AmountSliderForm(site, theme) {
  const min = site.amountMin || 100;
  const max = site.amountMax || 5000;
  const def = Math.round((min + max) / 2 / 100) * 100;
  return `
  <div class="b-form b-form--slider" id="form-anchor">
    <div class="b-form__header">
      <div class="b-form__title">How much do you need?</div>
    </div>
    <div class="b-form__amount-row">
      <span class="b-form__amount-display" id="amt-display">$${def.toLocaleString()}</span>
    </div>
    <input class="b-form__slider" type="range"
      id="amt-slider" min="${min}" max="${max}" step="100" value="${def}"
      aria-label="Loan amount">
    <div class="b-form__slider-labels">
      <span>$${Number(min).toLocaleString()}</span>
      <span>$${Number(max).toLocaleString()}</span>
    </div>
    <div class="b-form__row" style="margin-top:1rem">
      <input class="b-form__input b-form__input--zip" type="text"
        id="zip-input" inputmode="numeric" maxlength="5"
        placeholder="ZIP Code" aria-label="ZIP Code">
      <button class="b-btn b-btn--primary b-btn--form" id="zip-submit">${site.cta}</button>
    </div>
    <p class="b-form__note">By continuing you agree to our <a href="/privacy">Privacy Policy</a> & <a href="/terms">Terms</a>.</p>
    <script>
    (function(){
      var sldr=document.getElementById('amt-slider');
      var disp=document.getElementById('amt-display');
      var zip=document.getElementById('zip-input');
      var btn=document.getElementById('zip-submit');
      var clickid=new URLSearchParams(location.search).get('clickid')||'';
      var started=false;
      function fireStart(){
        if(started)return;started=true;
        if(typeof gtag==='function')gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formStartLabel||'FORM_START'}'});
        if(typeof pixel==='function')pixel('fl');
      }
      if(sldr){sldr.addEventListener('input',function(){
        var v=parseInt(this.value);
        if(disp)disp.textContent='$'+v.toLocaleString();
        fireStart();
        if(typeof pixel==='function')pixel('amt',{amount:v});
      });}
      if(zip){
        zip.addEventListener('focus',fireStart);
        zip.addEventListener('input',function(){
          this.value=this.value.replace(/\\D/g,'').slice(0,5);
          if(this.value.length===5&&typeof pixel==='function')pixel('ze',{zip:this.value});
        });
      }
      if(btn){btn.addEventListener('click',function(){
        var z=zip?zip.value.trim():'';
        if(z.length!==5){if(zip)zip.focus();return;}
        var amt=sldr?parseInt(sldr.value):${def};
        if(typeof gtag==='function')gtag('event','conversion',{send_to:'${site.conversionId||'AW-XXXXXXXXX'}/${site.formSubmitLabel||'FORM_SUBMIT'}'});
        if(typeof pixel==='function')pixel('fs',{zip:z,amount:amt,clickid:clickid});
        var url='${site.voluumClickUrl||'#'}'+(clickid?'?clickid='+clickid:'')+'&zip='+z+'&amount='+amt;
        setTimeout(function(){window.location.href=url;},150);
      });}
    })();
    <\/script>
  </div>`;
}

export const FORMS = {
  LeadsGateEmbed,
  LeadsGateCompact,
  ZipGateForm,
  AmountSliderForm,
};

export const FORM_IDS = Object.keys(FORMS);
