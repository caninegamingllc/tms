export type BolParty = {
  name: string;
  address: string;
  cityStateZip: string;
  sid?: string;
  cid?: string;
  locationNumber?: string;
  fob?: boolean;
};

/** VICS / standard blank Bill of Lading form data. */
export type BolFormData = {
  date: string;
  bolNumber: string;
  pageLabel: string;
  shipFrom: BolParty;
  shipTo: BolParty;
  carrierName: string;
  trailerNumber: string;
  sealNumbers: string;
  scac: string;
  proNumber: string;
  billTo: BolParty;
  freightChargeTerms: "PREPAID" | "COLLECT" | "THIRD_PARTY";
  specialInstructions: string;
  masterBol: boolean;
  customerOrders: Array<{
    orderNumber: string;
    pkgs: string;
    weight: string;
    palletSlip: "" | "Y" | "N";
    additionalInfo: string;
  }>;
  handlingUnitQty: string;
  handlingUnitType: string;
  packageQty: string;
  packageType: string;
  weight: string;
  hazardous: boolean;
  commodity: string;
  nmfc: string;
  freightClass: string;
  declaredValue: string;
  declaredValuePer: string;
  codAmount: string;
};
