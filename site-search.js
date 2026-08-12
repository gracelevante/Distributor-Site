/* ============================================================
   Inspired LED Pro Site — shared site-wide product search
   Link this file before </body> on every category page:
     <script src="site-search.js"></script>
   Also link site-search.css in the <head>.
   Searches across all 6 product categories at once, reusing the
   same sessionStorage caches the pages themselves already use, so
   repeat searches (or searches on categories you've already
   visited) are instant with no extra network calls.
   ============================================================ */
(function() {
  var API_URL = 'https://script.google.com/macros/s/AKfycbzVs0pljy0IM55Tm65BXky729JlOhA_hvPa_clDrKKatnZ0uvaK7LZ-E2DwRm8_FfEa/exec';
  var SHEET_ID = '1uwkWW5ItWHrLfhuP1BTbUOHouUQbyhtMemuexl3Y5H0';
  var CATEGORIES = [
    { sheet: 'LEDs', page: 'leds.html', label: 'LEDs' },
    { sheet: 'LED Sheets & Specialty', page: 'led-sheets.html', label: 'LED Sheets & Specialty' },
    { sheet: 'Power', page: 'power.html', label: 'Power' },
    { sheet: 'Connectors', page: 'connectors.html', label: 'Connectors' },
    { sheet: 'Channel & Lens Cover', page: 'channel-lens.html', label: 'Channel & Lens Cover' },
    { sheet: 'Control', page: 'control.html', label: 'Control' }
  ];

  function fetchFast(sheetName) {
    /* Google's quick public feed -- ~0.3s, but can occasionally lag a
       few minutes behind brand-new sheet edits. Used for the instant
       first result set. */
    var url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?sheet=' + encodeURIComponent(sheetName) + '&tqx=out:json';
    return fetch(url).then(function(res) { return res.text(); }).then(function(text) {
      var json = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));
      return json.table.rows.map(function(row) {
        return {
          name: (row.c[0] && row.c[0].v) || '',
          img: (row.c[1] && row.c[1].v) || '',
          spec: (row.c[2] && row.c[2].v) || '',
          sku: (row.c[3] && row.c[3].v) || '',
          section: (row.c[4] && row.c[4].v) || ''
        };
      }).filter(function(r) {
        return r.name && r.name.trim() && r.name.trim().toLowerCase() !== 'product name';
      });
    });
  }

  function fetchAuthoritative(sheetName) {
    /* Always-current, but noticeably slower and occasionally quite slow
       under heavy repeated use. Used to silently catch anything the fast
       feed missed (like a just-added product), never to block results. */
    return fetch(API_URL + '?sheet=' + encodeURIComponent(sheetName))
      .then(function(res) { return res.json(); })
      .then(function(rows) {
        return rows.filter(function(r) {
          return r.name && r.name.trim() && r.name.trim().toLowerCase() !== 'product name';
        });
      });
  }

  function fetchSheet(sheetName) {
    var cacheKey = 'il-products-' + sheetName;
    var cached = sessionStorage.getItem(cacheKey);
    if (cached) {
      try {
        var parsed = JSON.parse(cached);
        /* Only trust the cache if it actually has the shape search needs --
           older cached data (saved before spec-sheet linking existed, or by
           a different page's older code) might be missing the "spec" field
           entirely. If so, treat the cache as stale and fetch fresh instead
           of silently returning incomplete data. */
        var looksValid = Array.isArray(parsed) && (parsed.length === 0 || parsed[0].hasOwnProperty('spec'));
        if (looksValid) return Promise.resolve(parsed);
      } catch (e) {}
    }
    return fetchFast(sheetName);
  }

  var SIG = function(rows) { return rows.length + ':' + rows.map(function(r) { return r.name; }).join(','); };

  var indexPromise = null;
  var liveIndex = null;
  function buildIndex() {
    if (indexPromise) return indexPromise;

    /* 1. Resolve fast, from cache or the quick public feed -- search
       becomes usable almost immediately instead of waiting on Apps
       Script's occasionally slow response. */
    indexPromise = Promise.all(CATEGORIES.map(function(cat) {
      return fetchSheet(cat.sheet).then(function(rows) {
        return { cat: cat, rows: rows };
      }).catch(function() {
        return { cat: cat, rows: [] };
      });
    })).then(function(result) {
      liveIndex = result;
      return result;
    });

    /* 2. In the background, quietly double-check every category against
       the always-current source. If anything's different (a brand-new
       product the fast feed hadn't caught up on yet), update the live
       index in place and refresh the cache -- without ever blocking or
       re-showing a "searching" state to whoever's already typing. */
    Promise.all(CATEGORIES.map(function(cat) {
      return fetchAuthoritative(cat.sheet).then(function(rows) {
        return { cat: cat, rows: rows };
      }).catch(function() {
        return null;
      });
    })).then(function(authoritative) {
      authoritative.forEach(function(entry) {
        if (!entry || !liveIndex) return;
        var current = liveIndex.find(function(e) { return e.cat.sheet === entry.cat.sheet; });
        if (current && SIG(current.rows) !== SIG(entry.rows)) {
          current.rows = entry.rows;
          try { sessionStorage.setItem('il-products-' + entry.cat.sheet, JSON.stringify(entry.rows)); } catch (e) {}
        }
      });
    });

    return indexPromise;
  }

  /* Synonym map: lets people search common terms that don't literally
     appear in any product name (e.g. "transformers") and still find
     the right products (e.g. "driver"). Add more pairs here any time —
     key is what someone might type, value is the term(s) to also
     search for. Matching is bidirectional substring, so partial
     typing ("transform") still triggers the full synonym. */
  /* SKU/model-number aliases: several products only have "SEE SPEC SHEET"
     in their actual SKU field rather than real codes, since one product
     line covers many specific model variants. This maps each individual
     code straight to the right product, so searching any of them finds
     that exact spec sheet regardless of what's in the sheet's own SKU
     column. Matching is exact (case-insensitive, ignoring stray spaces). */
  var SKU_ALIASES = {
    // VersaDrive Series
    '8573': 'VersaDrive Series', '8585': 'VersaDrive Series',
    'vadt288l24dcod': 'VersaDrive Series', 'vad300l24dcod': 'VersaDrive Series',

    // Solid State (LinDrive Series) Dimmable Driver
    '3858': 'Solid State (LinDrive Series) Dimmable Driver',
    '3842': 'Solid State (LinDrive Series) Dimmable Driver',
    '85514': 'Solid State (LinDrive Series) Dimmable Driver',
    '3942': 'Solid State (LinDrive Series) Dimmable Driver',
    '3943': 'Solid State (LinDrive Series) Dimmable Driver',
    '8552': 'Solid State (LinDrive Series) Dimmable Driver',
    'slt20l12dc': 'Solid State (LinDrive Series) Dimmable Driver',
    'slt20l24dc': 'Solid State (LinDrive Series) Dimmable Driver',
    'slt40l12dc': 'Solid State (LinDrive Series) Dimmable Driver',
    'slt40l24dc': 'Solid State (LinDrive Series) Dimmable Driver',
    'slt60l12dc': 'Solid State (LinDrive Series) Dimmable Driver',
    'slt60l24dc': 'Solid State (LinDrive Series) Dimmable Driver',

    // Electronic (E-Series) Dimmable Driver
    '3578': 'Electronic (E-Series) Dimmable Driver',
    '3577': 'Electronic (E-Series) Dimmable Driver',
    '3936': 'Electronic (E-Series) Dimmable Driver',
    '3937': 'Electronic (E-Series) Dimmable Driver',
    '3579': 'Electronic (E-Series) Dimmable Driver',
    'e40l12dc-ko': 'Electronic (E-Series) Dimmable Driver',
    'e60l12dc-ko': 'Electronic (E-Series) Dimmable Driver',
    'e40l24dc-ko': 'Electronic (E-Series) Dimmable Driver',
    'e60l24dc-ko': 'Electronic (E-Series) Dimmable Driver',
    'e96l24dc-ko': 'Electronic (E-Series) Dimmable Driver',

    // Magnetic (M-Series) Dimmable Driver
    '4789': 'Magnetic (M-Series) Dimmable Driver',
    '4790': 'Magnetic (M-Series) Dimmable Driver',
    '4791': 'Magnetic (M-Series) Dimmable Driver',
    '3749': 'Magnetic (M-Series) Dimmable Driver',
    '3945': 'Magnetic (M-Series) Dimmable Driver',
    '3788': 'Magnetic (M-Series) Dimmable Driver',
    '3944': 'Magnetic (M-Series) Dimmable Driver',
    '3878': 'Magnetic (M-Series) Dimmable Driver',
    '3938': 'Magnetic (M-Series) Dimmable Driver',
    '3748': 'Magnetic (M-Series) Dimmable Driver',
    '3941': 'Magnetic (M-Series) Dimmable Driver',
    '3759': 'Magnetic (M-Series) Dimmable Driver',
    'm40l12dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm60l12dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm100l12dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm150l12dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm200l12dc': 'Magnetic (M-Series) Dimmable Driver',
    'm300l12dc': 'Magnetic (M-Series) Dimmable Driver',
    'm40l24dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm60l24dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm96l24dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm150l24dc-ar': 'Magnetic (M-Series) Dimmable Driver',
    'm200l24dc': 'Magnetic (M-Series) Dimmable Driver',
    'm300l24dc': 'Magnetic (M-Series) Dimmable Driver',

    // Solid State (Solidrive Series) Dimmable Driver
    '8538': 'Solid State (Solidrive Series) Dimmable Driver',
    'vop96l24dc': 'Solid State (Solidrive Series) Dimmable Driver',

    // Solid State (MinDrive Series) Dimmable Driver
    '8571': 'Solid State (MinDrive Series) Dimmable Driver',
    '8572': 'Solid State (MinDrive Series) Dimmable Driver',
    'smd60r12dc': 'Solid State (MinDrive Series) Dimmable Driver',
    'smd60r24vdc': 'Solid State (MinDrive Series) Dimmable Driver',

    // EMCOD Universal 5-in-1 Dimmable Driver
    '8620': 'EMCOD Universal 5-in-1 Dimmable Driver',
    '8621': 'EMCOD Universal 5-in-1 Dimmable Driver',
    '8622': 'EMCOD Universal 5-in-1 Dimmable Driver',
    '8623': 'EMCOD Universal 5-in-1 Dimmable Driver',
    '8624': 'EMCOD Universal 5-in-1 Dimmable Driver',
    '8625': 'EMCOD Universal 5-in-1 Dimmable Driver',
    '8626': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle60-12dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle100-12dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle200-12dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle300-12dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle100-24dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle200-24dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',
    'mle-24dc-ud': 'EMCOD Universal 5-in-1 Dimmable Driver',

    // EMCOD Dimmer + Driver Combo Switch
    '8615': 'EMCOD Dimmer + Driver Combo Switch',
    '8616': 'EMCOD Dimmer + Driver Combo Switch',
    'edd60-12dc': 'EMCOD Dimmer + Driver Combo Switch',
    'edd96-24dc': 'EMCOD Dimmer + Driver Combo Switch',

    // EMCOD Dimmer + Driver + CCT Combo Switch
    '8617': 'EMCOD Dimmer + Driver + CCT Combo Switch',
    'edd96-24dc-cct': 'EMCOD Dimmer + Driver + CCT Combo Switch',

    // EMCOD Magnetic LED Driver
    '3950': 'EMCOD Magnetic LED Driver',
    '3552': 'EMCOD Magnetic LED Driver',
    'ml40s12dc': 'EMCOD Magnetic LED Driver',
    'ml60s12dc': 'EMCOD Magnetic LED Driver',

    // HLG Series LED Power Supply
    '3855': 'HLG Series LED Power Supply',
    '3854': 'HLG Series LED Power Supply',
    '3693': 'HLG Series LED Power Supply',
    '3886': 'HLG Series LED Power Supply',
    '3769': 'HLG Series LED Power Supply',
    'hlg-150h-12b': 'HLG Series LED Power Supply',
    'hlg-320h-12b': 'HLG Series LED Power Supply',
    'hlg-150h-24b': 'HLG Series LED Power Supply',
    'hlg-240h-24b': 'HLG Series LED Power Supply',
    'hlg-320h-24b': 'HLG Series LED Power Supply',

    // LPF Series LED Power Supply
    '3765': 'LPF Series LED Power Supply',
    '3768': 'LPF Series LED Power Supply',
    'lpf-60d-12': 'LPF Series LED Power Supply',
    'lpf-90d-24': 'LPF Series LED Power Supply',

    // LPV Series LED Power Supply
    '3956': 'LPV Series LED Power Supply',
    'lpv-100-12': 'LPV Series LED Power Supply',

    // Plug-In LED Power Supply
    '3542': 'Plug-In LED Power Supply',
    '3753': 'Plug-In LED Power Supply',
    '8592': 'Plug-In LED Power Supply',
    '8584': 'Plug-In LED Power Supply',

    // 5 AMP Dimmable Plug-In Power Supply (PL/ST)
    '8614-pl': '5 AMP Dimmable Plug-In Power Supply (PL/ST)',
    '8614-st': '5 AMP Dimmable Plug-In Power Supply (PL/ST)',

    // iDea Series -- shares its companion-lens codes with several other channels
    '3566-w-set': 'iDea Series', '3633-w-set': 'iDea Series',
    '3566-c-set': 'iDea Series', '3633-c-set': 'iDea Series',
    '3566-w': 'iDea Series', '3566-c': 'iDea Series',
    '3565': 'iDea Series', '3606': 'iDea Series',
    '3633-w': 'iDea Series', '3633-c': 'iDea Series',
    '4953': 'iDea Series', '4952': 'iDea Series',
    '3567': 'iDea Series', '3551': 'iDea Series', '3590': 'iDea Series',

    // U-Shaped Short / Tall
    '8598': 'U-Shaped Short',
    '8597': 'U-Shaped Tall',

    // 12mm Inset Short / Black Inset Short / Tall Surface Mount Grooved
    // -- these three share the same companion lens codes
    '8574': '12mm Inset Short',
    '8574-bl': '12mm Black Inset Short',
    '8497-set-pc': '12mm Tall Surface Mount Grooved',
    '8497-set-sl': '12mm Tall Surface Mount Grooved',
    '8497': '12mm Tall Surface Mount Grooved',
    '8497-ch-al': '12mm Tall Surface Mount Grooved',

    // Radiant Edge Short / Tall
    '8492': 'Radiant Edge Short', '3771-w': 'Radiant Edge Short',
    '3662': ['Radiant Edge Short', 'Radiant Edge Tall'],
    '3772': 'Radiant Edge Short', '3773': 'Radiant Edge Short', '3739': ['Radiant Edge Short', 'Radiant Edge Tall'],
    '8493': 'Radiant Edge Tall', '3725-w': 'Radiant Edge Tall',
    '3750': 'Radiant Edge Tall', '3770': 'Radiant Edge Tall',

    // 1M Straight & Bendable
    '8588': '1M Straight & Bendable', '8587': '1M Straight & Bendable', '8589-b': '1M Straight & Bendable',

    // Impression Series Retrofit
    '3900-set-pc': 'Impression Series Retrofit',
    '3900-set-sl': 'Impression Series Retrofit',
    '3900-ch-al': 'Impression Series Retrofit',

    // Impression Series Narrow Flush Reveal / Edge Reveal One-Wing / Narrow Micro-Wing
    // -- these three share the exact same set of codes
    '8627': ['Impression Series Narrow Flush Reveal', 'Impression Series Edge Reveal, One-Wing', 'Impression Series Narrow Micro-Wing'],
    '3754': ['Impression Series Narrow Flush Reveal', 'Impression Series Edge Reveal, One-Wing', 'Impression Series Narrow Micro-Wing'],
    '8595-b': ['Impression Series Narrow Flush Reveal', 'Impression Series Edge Reveal, One-Wing', 'Impression Series Narrow Micro-Wing', '"Pi" Lens'],
    '3774': ['Impression Series Narrow Flush Reveal', 'Impression Series Edge Reveal, One-Wing', 'Impression Series Narrow Micro-Wing'],
    '3923': 'Impression Series Narrow Micro-Wing',

    // Impression Series Wide
    '3692': 'Impression Series Wide',

    // Companion lens codes shared across several surface-mount/recessed
    // channel products (iDea, 12mm Inset Short/Black/Grooved, 1M Straight
    // & Bendable, Impression Series Retrofit)
    '3902-ln-pc-fr': ['iDea Series', '12mm Inset Short', '12mm Black Inset Short', '12mm Tall Surface Mount Grooved', '1M Straight & Bendable', 'Impression Series Retrofit'],
    '8613-ln-sl-fr-b': ['iDea Series', '12mm Inset Short', '12mm Black Inset Short', '12mm Tall Surface Mount Grooved', '1M Straight & Bendable', 'Impression Series Retrofit', '12mm Inset Lens'],
    '8613': '12mm Inset Lens',

    // 1M In-Wall Lens
    '8589-ln-sl-fr-b': '1M In-Wall Lens',
    '8589': '1M In-Wall Lens',

    // Slat Wall FlexFit Series Black Silicone Lens
    '8618-b': 'Slat Wall FlexFit Series Black Silicone Lens',

    // Direct name shorthand for the M-Series and E-Series drivers
    'm series': 'Magnetic (M-Series) Dimmable Driver',
    'm-series': 'Magnetic (M-Series) Dimmable Driver',
    'e series': 'Electronic (E-Series) Dimmable Driver',
    'e-series': 'Electronic (E-Series) Dimmable Driver',

    // Lutron DVCL-153P (note: actual product name has a trailing space)
    'dvcl-153p-wh': 'Lutron DVCL-153P ',
    'dvcl-153-la': 'Lutron DVCL-153P ',
    'dvcl-153p-ivory': 'Lutron DVCL-153P ',
    'dvcl': 'Lutron DVCL-153P ',

    // Lutron DVLV-600P
    '4792': 'Lutron DVLV-600P',
    '4792-bl': 'Lutron DVLV-600P',
    '4792-br': 'Lutron DVLV-600P',
    '4792-iv': 'Lutron DVLV-600P',
    '4792-la': 'Lutron DVLV-600P',
    'dvlv': 'Lutron DVLV-600P',

    // Color-changing / RGB LED products (note: "24V COB RGBW" has a
    // trailing space in the actual product name)
    'color changing': ['24V COB RGBW ', '24V COB RGBCCT', '12V RGB Normal Bright', '12V RGB Super Bright', '24V RGBW Super Bright', '24V RGBCCT Super Bright', 'Specialty'],
    'color': ['24V COB RGBW ', '24V COB RGBCCT', '12V RGB Normal Bright', '12V RGB Super Bright', '24V RGBW Super Bright', '24V RGBCCT Super Bright', 'Specialty'],
    'rainbow': ['24V COB RGBW ', '24V COB RGBCCT', '12V RGB Normal Bright', '12V RGB Super Bright', '24V RGBW Super Bright', '24V RGBCCT Super Bright', 'Specialty']
  };

  var SYNONYMS = {
    'transformer': ['driver', 'power supply'],
    'transformers': ['driver', 'power supply'],
    'power supply': ['driver'],
    'power supplies': ['driver'],
    'driver': ['power supply', 'transformer'],
    'drivers': ['power supply', 'transformer'],
    'adapter': ['driver', 'connector'],
    'controller': ['control'],
    'remote': ['control'],
    'dimmer switch': ['dimmer'],
    'dimmable': ['dimmer'],
    'diffuser': ['lens', 'cover'],
    'tape light': ['led strip', 'flex'],
    'strip light': ['led strip', 'flex'],
    'rope light': ['led strip', 'flex'],
    'plug': ['connector', 'plug-in'],
    'wire': ['connector', 'wiring'],
    'aluminum channel': ['channel'],
    'aluminum': ['channel'],
    'track': ['channel'],
    'extrusion': ['channel'],
    'warranty': ['return policy'],
    'refund': ['return policy'],
    'stock rotation': ['rotation policy'],
    'waterproof': ['weather resistant'],
    'water resistant': ['weather resistant'],
    'outdoor': ['weather resistant'],
    'flexible': ['flex'],
    'cover': ['lens'],
    'lens cover': ['lens'],
    'extension': ['extender'],
    'quick connect': ['connector'],
    'quick connector': ['connector']
  };

  /* Power/Control drivers aren't tagged by voltage anywhere in the data
     (confirmed by testing), so treating "24V driver" as requiring a
     literal "24V" match would just return nothing -- unhelpful. Instead,
     when a voltage term shows up next to a driver-family word
     specifically, the voltage is dropped and the whole driver/power
     family is shown. This does NOT apply elsewhere (e.g. "24V COB"
     still filters by voltage normally, since that data does exist). */
  var VOLTAGE_RE = /^\d{1,3}v$/i;
  var DRIVER_FAMILY_TERMS = ['driver', 'drivers', 'transformer', 'transformers', 'power supply', 'power supplies', 'adapter', 'adapters'];

  function tokenizeAndExpand(q) {
    /* Normalize "24 V" / "24v" / "24V" to a single consistent token "24v" */
    q = q.replace(/(\d{1,3})\s*v\b/gi, function(m, num) { return num + 'v'; });

    var remaining = ' ' + q + ' ';
    var groups = [];

    /* Multi-word synonym keys first (longest first, so "power supply"
       is matched whole rather than leaving stray "supply" behind) */
    var multiWordKeys = Object.keys(SYNONYMS).filter(function(k) { return k.indexOf(' ') !== -1; });
    multiWordKeys.sort(function(a, b) { return b.length - a.length; });
    multiWordKeys.forEach(function(key) {
      var idx = remaining.indexOf(key);
      if (idx !== -1) {
        groups.push([key].concat(SYNONYMS[key]));
        remaining = remaining.slice(0, idx) + ' ' + remaining.slice(idx + key.length);
      }
    });

    var tokens = remaining.trim().split(/\s+/).filter(Boolean);

    var hasVoltageToken = tokens.some(function(t) { return VOLTAGE_RE.test(t); });
    var hasDriverFamilyTerm =
      tokens.some(function(t) { return DRIVER_FAMILY_TERMS.indexOf(t) !== -1; }) ||
      groups.some(function(g) { return g.some(function(t) { return DRIVER_FAMILY_TERMS.indexOf(t) !== -1; }); });
    var dropVoltage = hasVoltageToken && hasDriverFamilyTerm;

    /* Whatever's left gets split into individual words, each expanded
       independently -- so "24V driver" becomes two required groups:
       ["24v"] and ["driver","power supply","transformer"], and a
       product must match something in BOTH groups, not just one --
       UNLESS this is the voltage+driver-family case above, in which
       case the voltage token is skipped entirely. */
    tokens.forEach(function(tok) {
      if (dropVoltage && VOLTAGE_RE.test(tok)) return;
      var group = [tok];
      Object.keys(SYNONYMS).forEach(function(key) {
        if (key.indexOf(' ') === -1 && (tok === key || key.indexOf(tok) !== -1 || tok.indexOf(key) !== -1)) {
          group = group.concat(SYNONYMS[key]);
        }
      });
      groups.push(group);
    });

    return groups;
  }

  function filterIndex(query, index) {
    var q = query.trim().toLowerCase();
    if (!q) return [];

    /* Extra terms that should jump straight to a whole category page
       even though they don't literally match that category's own name
       (e.g. "dimmer" doesn't contain "control", but should still go
       there). Add more of these any time a term should behave this way. */
    var CATEGORY_SHORTCUTS = {
      'dimmer': 'Control',
      'dimmers': 'Control',
      'dimmer switch': 'Control',
      'dimmer switches': 'Control',
      'led dimmer': 'Control',
      'remote': 'Control',
      'remotes': 'Control',
      'receiver': 'Control',
      'receivers': 'Control',
      'controllers': 'Control',
      'transformer': 'Power',
      'transformers': 'Power',
      'driver': 'Power',
      'drivers': 'Power',
      'aluminum': 'Channel & Lens Cover',
      'lens': 'Channel & Lens Cover',
      'lens cover': 'Channel & Lens Cover',
      'channels': 'Channel & Lens Cover',
      'panels': 'Channel & Lens Cover',
      'panel': 'Channel & Lens Cover',
      'led': 'LEDs',
      'reel': 'LEDs',
      'reels': 'LEDs',
      'strips': 'LEDs',
      'led strips': 'LEDs',
      'led strip': 'LEDs',
      'warm white': 'LEDs',
      'pure white': 'LEDs',
      'cool white': 'LEDs',
      '2500k': 'LEDs',
      '2700k': 'LEDs',
      '3000k': 'LEDs',
      '3500k': 'LEDs',
      '400k': 'LEDs',
      '4000k': 'LEDs',
      '4500k': 'LEDs',
      '6000k': 'LEDs',
      '2500': 'LEDs',
      '2700': 'LEDs',
      '3000': 'LEDs',
      '3500': 'LEDs',
      '400': 'LEDs',
      '4000': 'LEDs',
      '4500': 'LEDs',
      '6000': 'LEDs'
    };
    if (CATEGORY_SHORTCUTS[q]) {
      var shortcutCat = CATEGORIES.find(function(cat) { return cat.sheet === CATEGORY_SHORTCUTS[q]; });
      if (shortcutCat) return [{ isCategory: true, cat: shortcutCat }];
    }

    /* Voltage-qualified driver/transformer searches ("12V transformer",
       "24V transformers", "24 V driver", etc.) also jump straight to
       Power -- same reasoning as the driver-family voltage bypass below:
       that data isn't tagged by voltage, so showing the whole category
       is more useful than a filtered miss. */
    var qNormalized = q.replace(/(\d{1,3})\s*v\b/gi, function(m, num) { return num + 'v'; });
    var voltageDriverParts = qNormalized.split(/\s+/).filter(Boolean);
    var BARE_NUMBER_RE = /^\d{1,3}$/;
    var firstPartIsVoltageLike = voltageDriverParts.length === 2 &&
      (VOLTAGE_RE.test(voltageDriverParts[0]) || BARE_NUMBER_RE.test(voltageDriverParts[0]));
    if (firstPartIsVoltageLike &&
        DRIVER_FAMILY_TERMS.indexOf(voltageDriverParts[1]) !== -1) {
      var powerCat = CATEGORIES.find(function(cat) { return cat.sheet === 'Power'; });
      if (powerCat) return [{ isCategory: true, cat: powerCat }];
    }

    /* Voltage + specific-series word ("12V magnetic", "24V electronic",
       or bare "24 magnetic") route straight to that one product's spec
       sheet -- same voltage data gap as above, but here there's one
       clear right answer rather than a whole category to show. "12V
       EMCOD" / "24V EMCOD" instead drop the voltage and search "emcod"
       normally, since EMCOD covers several distinct products, not one. */
    if (firstPartIsVoltageLike) {
      var VOLTAGE_QUALIFIER_PRODUCTS = {
        'magnetic': 'Magnetic (M-Series) Dimmable Driver',
        'electronic': 'Electronic (E-Series) Dimmable Driver'
      };
      var qualifierProduct = VOLTAGE_QUALIFIER_PRODUCTS[voltageDriverParts[1]];
      if (qualifierProduct) {
        var qualifierMatches = [];
        index.forEach(function(entry) {
          entry.rows.forEach(function(r) {
            if (r.name === qualifierProduct) qualifierMatches.push({ product: r, cat: entry.cat });
          });
        });
        if (qualifierMatches.length > 0) return qualifierMatches;
      }
      if (voltageDriverParts[1] === 'emcod') {
        q = 'emcod'; /* drop the voltage, fall through to normal search below */
      }
    }

    /* If the search matches one of the actual nav category names
       (LEDs, Power, Connectors, etc.), skip individual product matching
       entirely and just point straight at that whole category page. */
    var categoryMatch = CATEGORIES.find(function(cat) {
      var label = cat.label.toLowerCase();
      return label === q || (q.length >= 4 && (label.indexOf(q) !== -1 || q.indexOf(label) !== -1));
    });
    if (categoryMatch) {
      return [{ isCategory: true, cat: categoryMatch }];
    }

    /* Exact SKU/model-number alias match takes priority -- if someone
       searches one of these codes exactly, jump straight to that one
       product rather than running it through normal word matching. */
    var aliasNormalized = q.replace(/\s+/g, '');
    var aliasTargetRaw = SKU_ALIASES[q] || SKU_ALIASES[aliasNormalized];
    if (aliasTargetRaw) {
      var aliasTargets = Array.isArray(aliasTargetRaw) ? aliasTargetRaw : [aliasTargetRaw];
      var aliasMatches = [];
      index.forEach(function(entry) {
        entry.rows.forEach(function(r) {
          if (aliasTargets.indexOf(r.name) !== -1) {
            aliasMatches.push({ product: r, cat: entry.cat });
          }
        });
      });
      if (aliasMatches.length > 0) return aliasMatches;
      /* fall through to normal search if the aliased product somehow
         isn't in the index (e.g. sheet changed since this was written) */
    }

    var groups = tokenizeAndExpand(q);
    if (groups.length === 0) return [];

    var matches = [];
    var seen = {};
    index.forEach(function(entry) {
      entry.rows.forEach(function(r) {
        var haystack = [r.name, r.sku, r.section].filter(Boolean).join(' ').toLowerCase();
        var allGroupsMatch = groups.every(function(group) {
          return group.some(function(t) { return haystack.indexOf(t) !== -1; });
        });
        if (allGroupsMatch) {
          var key = entry.cat.page + '|' + r.name;
          if (!seen[key]) {
            seen[key] = true;
            matches.push({ product: r, cat: entry.cat });
          }
        }
      });
    });
    return matches.slice(0, 8);
  }

  function thumbUrl(img) {
    return img ? img.replace(/-\d+x\d+(?=\.\w+$)/, '-300x225') : '';
  }

  function renderResults(matches, container, query) {
    if (matches.length === 0) {
      container.innerHTML = '<div class="site-search-empty">No products found for "' + query + '".</div>';
      container.classList.add('open');
      return;
    }
    container.innerHTML = matches.map(function(m) {
      if (m.isCategory) {
        return '<a class="site-search-category-link" href="' + m.cat.page + '">' +
          '<span class="site-search-category-icon">\u2192</span>' +
          '<span>View all <strong>' + m.cat.label + '</strong> products</span></a>';
      }
      var img = thumbUrl(m.product.img);
      var imgHtml = img
        ? '<img src="' + img + '" alt="" loading="lazy" onerror="this.parentElement.innerHTML=\'\uD83D\uDCA1\';this.parentElement.className=\'site-search-noimg\';">'
        : '\uD83D\uDCA1';
      /* Link straight to the spec sheet PDF when the product has one
         (matches how the "Spec Sheet" buttons work on the category
         pages themselves); if a product has no spec sheet on file,
         fall back to its category page instead of a dead link. */
      var hasSpec = !!m.product.spec;
      var href = hasSpec ? m.product.spec : m.cat.page;
      var target = hasSpec ? ' target="_blank" rel="noopener noreferrer"' : '';
      var badge = hasSpec ? '<span class="site-search-result-badge">PDF</span>' : '';
      return '<a class="site-search-result" href="' + href + '"' + target + '>' +
        '<span class="site-search-thumb">' + imgHtml + '</span>' +
        '<span class="site-search-result-text"><span class="site-search-result-name">' + m.product.name + '</span>' +
        '<span class="site-search-result-cat">' + m.cat.label + '</span></span>' + badge + '</a>';
    }).join('');
    container.classList.add('open');
  }

  window.ILSearch = { buildIndex: buildIndex, filterIndex: filterIndex, renderResults: renderResults, tokenizeAndExpand: tokenizeAndExpand };

  function init() {
    var pageWrapper = document.querySelector('.page-wrapper');
    if (!pageWrapper || document.querySelector('.site-search-wrap')) return;

    var wrap = document.createElement('div');
    wrap.className = 'site-search-wrap';
    wrap.innerHTML =
      '<span class="site-search-icon">\uD83D\uDD0D</span>' +
      '<input type="text" class="site-search-input" placeholder="Search all products\u2026" autocomplete="off">' +
      '<div class="site-search-results"></div>';

    pageWrapper.insertBefore(wrap, pageWrapper.firstChild);

    var input = wrap.querySelector('.site-search-input');
    var results = wrap.querySelector('.site-search-results');

    var debounceTimer;
    input.addEventListener('input', function() {
      clearTimeout(debounceTimer);
      var q = input.value;
      debounceTimer = setTimeout(function() {
        if (!q.trim()) {
          results.classList.remove('open');
          results.innerHTML = '';
          return;
        }
        results.innerHTML = '<div class="site-search-empty">Searching\u2026</div>';
        results.classList.add('open');
        buildIndex().then(function(index) {
          var matches = filterIndex(q, index);
          renderResults(matches, results, q);
        });
      }, 250);
    });

    document.addEventListener('click', function(e) {
      if (!wrap.contains(e.target)) {
        results.classList.remove('open');
      }
    });

    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') results.classList.remove('open');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();