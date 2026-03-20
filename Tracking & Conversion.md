## 4. Module 2 — Tracking & Conversion (NO GTM / NO GA4)

### 4.1 Stack

| Layer                    | Purpose                                               | Google dependency?            |
| ------------------------ | ----------------------------------------------------- | ----------------------------- |
| gtag.js (AW-only)        | Micro-conv to train Google Ads AI                     | Yes but only AW-ID, easy swap |
| Custom First-Party Pixel | Permanent data in D1 via CF Worker                    | No                            |
| Voluum                   | Click tracking + sold_lead s2s postback to Google Ads | No                            |

**Removed:** GTM, GA4, Offline CSV Upload, Apps Script

### 4.2 Only 3 Conversion Actions

| Action      | Type      | Trigger                                     | Method              |
| ----------- | --------- | ------------------------------------------- | ------------------- |
| form_start  | Secondary | LeadsGate onFormLoad or amount/zip interact | gtag.js             |
| form_submit | Primary   | LeadsGate onSubmit                          | gtag.js             |
| sold_lead   | Primary   | Network approves lead                       | Voluum s2s postback |

### 4.3 Form Embed Code

```javascript
<script>
window.dataLayer = window.dataLayer || [];

// Safe Storage Helper
var SafeStorage = {
  _mem: {},
  set: function(k, v) {
    try { sessionStorage.setItem(k, v); } 
    catch (e) { this._mem[k] = v; }
  },
  get: function(k) {
    try { return sessionStorage.getItem(k); } 
    catch (e) { return this._mem[k] || null; }
  }
};

// Helper: Get Voluum Click ID
function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  var cid = urlParams.get('cid') || urlParams.get('click_id');
  return SafeStorage.get('voluum_cid') || cid || '';
}

// LeadsGate Form Configuration WITH CALLBACKS
var _lg_form_init_ = {
  aid: "14881",
  template: "fresh",
  ref: window.location.hostname,
  click_id: getVoluumClickId(),
  
  // ===== CALLBACKS (Network ให้ใช้แล้ว) =====
  
  // Callback: Form Load
  onFormLoad: function() {
    console.log('📋 LeadsGate form loaded');
    
    window.dataLayer.push({
      'event': 'leadsgate_form_start',
      'clickId': getVoluumClickId(),
      'gclid': SafeStorage.get('google_gclid'),
      'timestamp': new Date().toISOString()
    });
  },
  
  // Callback: Step Change
  onStepChange: function(step) {
    console.log('📊 Form step:', step);
    
    window.dataLayer.push({
      'event': 'leadsgate_form_progress',
      'step': step,
      'clickId': getVoluumClickId()
    });
  },
  
  // Callback: Form Submit
  onSubmit: function() {
    console.log('📤 Form submitted');
    
    window.dataLayer.push({
      'event': 'leadsgate_form_submit',
      'clickId': getVoluumClickId(),
      'timestamp': new Date().toISOString()
    });
  },
  
  // Callback: Success (เมื่อ LeadsGate ประมวลผลเสร็จ)
  onSuccess: function(data) {
    console.log('✅ LeadsGate Response:', data);
    
    var voluumCid = getVoluumClickId();
    var googleGclid = SafeStorage.get('google_gclid');
    
    // Parse LeadsGate Response
    var type = data.type;              // soldLead / rejectLead / newLead
    var leadId = data.lead_id;         // Lead ID
    var payout = data.price || 0;      // Revenue/Payout
    
    // Determine Status
    var status = 'pending';
    if (type === 'soldLead') status = 'approved';
    else if (type === 'rejectLead') status = 'declined';
    
    // Determine Payout
    var finalPayout = payout > 0 ? payout : (status === 'declined' ? 5.00 : 50.00);
    
    console.log('📊 Parsed:', {
      type: type,
      status: status,
      leadId: leadId,
      payout: finalPayout
    });
    
    // Conversion Data
    var conversionData = {
      transaction_id: leadId,
      value: finalPayout,
      currency: 'USD',
      status: status,
      type: type,
      click_id: voluumCid,
      gclid: googleGclid,
      created: data.created
    };
    
    // ===== TRACK ALL LEADS (Google Ads Learning) =====
    window.dataLayer.push({
      'event': 'lead_conversion_all',
      'leadData': conversionData,
      'conversionValue': finalPayout,
      'leadStatus': status,
      'leadType': type,
      'transactionId': leadId,
      'clickId': voluumCid,
      'gclid': googleGclid
    });
    
    console.log('✅ All leads tracked:', status, 'Type:', type, 'Payout:', finalPayout);
    
    // ===== TRACK APPROVED (soldLead) =====
    if (type === 'soldLead') {
      window.dataLayer.push({
        'event': 'lead_conversion_approved',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      
      console.log('✅ Approved lead tracked | Payout:', finalPayout);
    }
    
    // ===== TRACK DECLINED (rejectLead) =====
    if (type === 'rejectLead') {
      window.dataLayer.push({
        'event': 'lead_declined',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      
      console.log('⚠️ Declined lead tracked | Payout:', finalPayout);
    }
    
    // ===== TRACK PENDING (newLead) =====
    if (type === 'newLead') {
      window.dataLayer.push({
        'event': 'lead_pending',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      
      console.log('⏳ Pending lead tracked | Payout:', finalPayout);
    }
    
    console.log('✅ Tracking complete for Lead ID:', leadId);
  }
};

// Load LeadsGate Form Script
var script = document.createElement('script');
script.type = 'text/javascript';
script.async = true;
script.src = 'https://apikeep.com/form/applicationInit.js';
document.body.appendChild(script);
</script>

<!-- Form Container -->
<div id="_lg_form_"></div>
```

### 4.4 Conversion Flow

```
Google Ads click
  > Voluum (capture clickid)
  > LP (clickid in URL)
  > LeadsGate form (click_id via _lg_form_init_)
  > onFormLoad > gtag form_start
  > onStepChange > custom pixel
  > onSubmit > gtag form_submit
  > onSuccess > custom pixel
  > LeadsGate auto redirect > offer page (e.g. dollarloancash.com)
  > Lead approved > postback > Voluum (s2s) > Google Ads
```

### 4.5 Front Page Micro-Conv (Amount + ZIP)

```javascript
let formStarted = false;
function fireFormStart() {
    if (formStarted) return;
    formStarted = true;
    gtag('event', 'conversion', { send_to: 'AW-XXX/form_start_label' });
    pixel('fs');
}
amountSlider.onChange(() => fireFormStart());
zipInput.onFocus(() => fireFormStart());

// Detail to custom pixel only
amountSlider.onChange((val) => pixel('amt', { amount: val }));
zipInput.onChange((val) => { if (val.length === 5) pixel('ze', { zip: val }); });
```

### 4.6 Custom First-Party Pixel

- Endpoint: `https://t.{domain}.com/e` via CF Worker
- Method: sendBeacon (non-blocking)
- Storage: Cloudflare D1
- Events: page_view, form_load, step_change, form_submit, success, scroll_25/50/75/100, time_on_page_30s/60s, amount_selected, zip_entered

---

## 4.7 Campaign tracking *(required)*

1. **Install Lander Tracking Script**

​       Paste your Voluum Lander Tracking Script into your lander page’s HTML. Place it at the bottom of the `<head>` tag section.

**Lander tracking script**

* ตรง Sub domain ถ้าทำให้มัน random เองได้่จะดีมาก ฉันอยากไม่ให้ คู่แข่งรู้ Techstack และคำที่ random อยากให้เป็นคำที่ ไม่สื่อถึงว่าเป็น tracking

<meta http-equiv="delegate-ch" content="sec-ch-ua https://sub.domain.com; sec-ch-ua-mobile https://sub.domain.com; sec-ch-ua-arch https://sub.domain.com; sec-ch-ua-model https://sub.domain.com; sec-ch-ua-platform https://sub.domain.com; sec-ch-ua-platform-version https://sub.domain.com; sec-ch-ua-bitness https://sub.domain.com; sec-ch-ua-full-version-list https://sub.domain.com; sec-ch-ua-full-version https://sub.domain.com"><style>.dtpcnt{opacity: 0;}</style>
<script>
    (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\s+)dtpcnt($|\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+
"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\/?click\/?($|(\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&
t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\.l="([^"]+)/)[1]);A()};
q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","subs","href","className","onerror","dtpCallback",0,"https://sub.domain.com/d/.js","savedCep");
</script>
<noscript><sub href="https://sub.domain.com/d/.js?noscript=true&lpurl=" rel="stylesheet"/></noscript>


