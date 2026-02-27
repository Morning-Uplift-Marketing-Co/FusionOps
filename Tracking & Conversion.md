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
var clickid = new URLSearchParams(window.location.search).get('clickid') || '';

var _lg_form_init_ = {
    aid: "14881",
    template: "fresh",
    click_id: clickid,

    onFormLoad: function() {
        gtag('event', 'conversion', { send_to: 'AW-XXX/form_start_label' });
        pixel('fl');
    },

    onStepChange: function(step) {
        pixel('step', { step: step });
    },

    onSubmit: function() {
        gtag('event', 'conversion', { send_to: 'AW-XXX/form_submit_label' });
        pixel('fs', { clickid });
    },

    onSuccess: function(response) {
        pixel('success', { clickid, lead_id: response?.lead_id });
        // No redirect — LeadsGate redirects to offer page automatically
    }
};
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

<meta http-equiv="delegate-ch" content="sec-ch-ua https://trk.domain].com; sec-ch-ua-mobile https://trk.domain].com; sec-ch-ua-arch https://trk.domain].com; sec-ch-ua-model https://trk.domain].com; sec-ch-ua-platform https://trk.domain].com; sec-ch-ua-platform-version https://trk.domain].com; sec-ch-ua-bitness https://trk.domain].com; sec-ch-ua-full-version-list https://trk.domain].com; sec-ch-ua-full-version https://trk.domain].com"><style>.dtpcnt{opacity: 0;}</style>
<script>
    (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\s+)dtpcnt($|\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+
"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\/?click\/?($|(\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&
t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\.l="([^"]+)/)[1]);A()};
q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,"https://trk.domain].com/d/.js","savedCep");
</script>
<noscript><link href="https://trk.domain].com/d/.js?noscript=true&lpurl=" rel="stylesheet"/></noscript>





**Submit Lander Tracking URL to Google Ads - Search/Display**

1. Go to [Google Ads - Search/Display ](https://ads.google.com/nav/login)and create or edit a campaign.
2. Set the Voluum Lander Tracking URL as the destination page.

Lander Tracking URL

`https://domain.com?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}&campaignid={campaignid}&adgroupid={adgroupid}&loc_physicall_ms={loc_physical_ms}&loc_interest_ms={loc_interest_ms}&matchtype={matchtype}&network={network}&creative={creative}&keyword={keyword}&placement={placement}&targetid={targetid}&cpid=e0369924-c26f-42ea-8170-5c8e80e08670&lpid=ee2915e4-e741-46fe-bb31-7fcf63f529d7`



### 4.6 Click URLs to lander CTA Botton

- Ensure the links are inside the `<body>` section.
- 
- https://trk.domain.com/click