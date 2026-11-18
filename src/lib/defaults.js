// Starting data for a brand-new account. Everything here can be edited inside the app.
export const DEFAULT_SETTINGS = {
  company: {
    name: 'MARUTHI TRAVELS', tagline: '(Tamilnadu & pondicherry)', proprietor: 'G.MALLIKARANI',
    mobile: '', gstin: '', category: 'Rental Services of Road Vehicles',
    bankName: 'MARUTHI TRAVELS', bankAcc: '', ifsc: '', branch: '', signName: 'MARUTHI TRAVELS',
  },
  nextInvoice: 314,
  igstPct: 5,
  addIgst: false,
  extraUnitMin: 60,
  graceMin: 0,
  gstNote: 'Note: IGST @5% or both CGST @ 2.5% & SGST @ 2.5% on above taxable value is to be paid by the service receiver under reverse charge mechanism vide integrated Tax (rate) Notification No 21/2019 Dt 30/09/2019 or central Tax (rate) Notification No 22/2019 Dt 30/09/2019',
  tripTypes: {
    local: { label: 'LOCAL 80 KMS / 8 HRS', hours: 8, km: 80 },
    airport: { label: 'AIRPORT TRANSFER', hours: 4, km: 40 },
    outstation: { label: 'OUTSTATION', kmPerDay: 300 },
  },
};

export const DEFAULT_VEHICLES = [
  { name: 'SEDAN', localPkg: 2100, localHr: 150, localKm: 13, airPkg: 1000, airHr: '', airKm: '', hill: 800, outKm: 13, driver: 300 },
  { name: 'INNOVA/ERTIGA', localPkg: 2700, localHr: 200, localKm: 17, airPkg: 1600, airHr: '', airKm: '', hill: 1000, outKm: 17, driver: 400 },
  { name: 'INNOVA CRYSTA', localPkg: 3400, localHr: 250, localKm: 21, airPkg: 1600, airHr: '', airKm: '', hill: 1000, outKm: 21, driver: 400 },
  { name: 'HYCROSS', localPkg: 4500, localHr: 350, localKm: 26, airPkg: 2000, airHr: '', airKm: '', hill: 1000, outKm: 26, driver: 400 },
  { name: 'TEMPO TRAVELLER', localPkg: 4500, localHr: 350, localKm: 24, airPkg: 2000, airHr: '', airKm: '', hill: 1200, outKm: 24, driver: 600 },
];
