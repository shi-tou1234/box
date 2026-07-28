const PACKAGE_SUGGESTIONS = {
  '电阻': ['0402', '0603', '0805', '1206', '1210', '2010', '2512', 'AXIAL-0.3', 'AXIAL-0.4', 'MELF'],
  '电容': ['0402', '0603', '0805', '1206', '1210', '1812', 'RADIAL-0.1', 'RADIAL-0.2', 'SMC', 'D-case'],
  '电感': ['0402', '0603', '0805', '1206', '2520', '3225', '4532', 'THT-axial'],
  '二极管': ['SOD-123', 'SOD-323', 'SOD-523', 'SMA', 'SMB', 'SMC', 'MELF', 'DO-35', 'DO-41'],
  '三极管/MOSFET': ['SOT-23', 'SOT-323', 'SOT-89', 'SOT-223', 'DPAK', 'D2PAK', 'TO-92', 'TO-220', 'TO-247'],
  'IC/集成电路': ['DIP-8', 'DIP-14', 'DIP-16', 'DIP-20', 'DIP-28', 'SOIC-8', 'SOIC-14', 'SOIC-16', 'TSSOP-20', 'QFN-32', 'LQFP-48', 'LQFP-64', 'BGA-100'],
  'MCU/单片机': ['LQFP-32', 'LQFP-48', 'LQFP-64', 'LQFP-100', 'QFN-32', 'QFN-48', 'TQFP-44'],
  'LED': ['0402', '0603', '0805', '1206', '5050', '3528', '2835', 'PLCC-2', '5mm-THT', '3mm-THT'],
  '连接器': ['XH-2.54', 'PH-2.0', 'ZH-1.5', 'KK-2.54', 'MX3.0', 'SMD-1.27'],
  '晶振': ['HC-49S', 'HC-49U', 'SMD-3225', 'SMD-5032', 'SMD-7050'],
  '排针/排母': ['1x2', '1x4', '1x8', '1x20', '2x4', '2x20', '2.54mm', '2.0mm', '1.27mm'],
  '继电器': ['DIP-4', 'DIP-5', 'DIP-6', 'DIP-8', 'SMD-4'],
  '保险丝': ['0603F', '0805F', '1203F', '5x20', '6x30'],
};

const CATEGORY_SYNONYMS = {
  '电阻': ['电阻', 'Resistor'],
  '电容': ['电容', 'Capacitor'],
  '电感': ['电感', 'Inductor'],
  '二极管': ['二极管', 'Diode'],
  '三极管/MOSFET': ['三极管', 'MOSFET', 'MOSFET / Transistor', 'Transistor'],
  'IC/集成电路': ['IC', '集成电路', 'IC / 集成电路'],
  'MCU/单片机': ['MCU', '单片机', 'MCU / 单片机'],
  'LED': ['LED'],
  '连接器': ['连接器', 'Connector', '连接器 / Connector'],
  '晶振': ['晶振', 'Crystal', '晶振 / Crystal'],
  '排针/排母': ['排针', '排母', '排针/排母'],
  '继电器': ['继电器', 'Relay', '继电器 / Relay'],
  '保险丝': ['保险丝', 'Fuse', '保险丝 / Fuse'],
};

const CATEGORY_ALIAS_MAP = new Map();
Object.entries(CATEGORY_SYNONYMS).forEach(([key, aliases]) => {
  aliases.forEach((alias) => {
    CATEGORY_ALIAS_MAP.set(alias.trim().toLowerCase(), key);
  });
});

function resolveCategoryKey(category = '') {
  return CATEGORY_ALIAS_MAP.get(category.trim().toLowerCase()) || category.trim();
}

function getPackageSuggestions(category = '') {
  const key = resolveCategoryKey(category);
  return PACKAGE_SUGGESTIONS[key] || [];
}

function getCategoryOptions() {
  return Object.keys(PACKAGE_SUGGESTIONS);
}

function collectUsedPackages(category = '') {
  const key = resolveCategoryKey(category);
  return [];
}

