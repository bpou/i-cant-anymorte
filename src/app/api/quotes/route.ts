import { NextRequest, NextResponse } from "next/server";
import { createFortnoxQuote } from "@/lib/fortnox";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const customerNumber = body?.customerNumber ? String(body.customerNumber) : "";
    if (!customerNumber) {
      return NextResponse.json({ error: "customerNumber is required" }, { status: 400 });
    }

    const rowsInput: any[] = Array.isArray(body?.rows) ? body.rows : [];
    const offerRows = rowsInput
      .map((row) => {
        const quantity = Number(row?.Quantity ?? row?.quantity ?? row?.OrderedQuantity ?? 0);
        const price = Number(row?.Price ?? row?.price ?? 0);
        const discount = row?.Discount ?? row?.discount;
        const vat = row?.VAT ?? row?.vat ?? row?.vatPercent;
        if (!quantity && !price && !row?.ArticleNumber && !row?.articleNumber && !row?.Description && !row?.description) {
          return null;
        }
        const payload: any = {
          ArticleNumber: row?.ArticleNumber ?? row?.articleNumber ?? undefined,
          Description: row?.Description ?? row?.description ?? undefined,
          Quantity: quantity || 0,
          Unit: row?.Unit ?? row?.unit ?? undefined,
          Price: price || 0,
        };
        if (discount != null && discount !== "") {
          const disc = Number(discount);
          if (!Number.isNaN(disc)) payload.Discount = disc;
        }
        if (vat != null && vat !== "") {
          const vatNum = Number(vat);
          if (!Number.isNaN(vatNum)) payload.VAT = vatNum;
        }
        if (row?.Account ?? row?.account ?? row?.accountNumber) {
          payload.Account = String(row?.Account ?? row?.account ?? row?.accountNumber);
        }
        return payload;
      })
      .filter((row): row is Record<string, unknown> => !!row && row.Quantity !== 0);

    if (!offerRows.length) {
      return NextResponse.json({ error: "At least one quote row is required" }, { status: 400 });
    }

    const offer: any = {
      CustomerNumber: customerNumber,
      OfferDate: body?.offerDate || new Date().toISOString().slice(0, 10),
      OfferRows: offerRows,
    };

    const applyString = (key: string, value: unknown) => {
      if (typeof value === "string" && value.trim()) {
        offer[key] = value.trim();
      }
    };
    const applyNumber = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === "") return;
      const num = Number(value);
      if (!Number.isNaN(num)) {
        offer[key] = num;
      }
    };

    applyString("ValidUntil", body?.validUntil);
    applyString("DeliveryDate", body?.deliveryDate);
    applyString("OurReference", body?.ourReference);
    applyString("YourReference", body?.yourReference);
    applyString("YourReferenceNumber", body?.yourReferenceNumber);
    applyString("PriceList", body?.priceList);
    if (typeof body?.pricesInclVAT === "boolean") {
      offer.VATIncluded = body.pricesInclVAT;
    }
    applyString("Currency", body?.currency);
    applyNumber("CurrencyRate", body?.exchangeRate);
    applyString("VATType", body?.vatType);
    applyString("TermsOfPayment", body?.termsOfPayment);
    applyString("TermsOfDelivery", body?.termsOfDelivery);
    applyString("WayOfDelivery", body?.wayOfDelivery);
    applyString("OfferText", body?.offerText);
    applyNumber("Freight", body?.freight);
    applyNumber("InvoiceFee", body?.invoiceFee);
    applyNumber("InvoiceDiscount", body?.invoiceDiscountPercent);
    applyString("PrintTemplate", body?.printTemplate);
    applyString("Language", body?.language);

    // Invoice/billing details
    applyString("CustomerName", body?.invoiceName);
    applyString("Address1", body?.invoiceAddress1);
    applyString("Address2", body?.invoiceAddress2);
    applyString("ZipCode", body?.invoiceZip);
    applyString("City", body?.invoiceCity);
    applyString("Country", body?.invoiceCountry);
    applyString("OrganisationNumber", body?.organisationNumber);
    applyString("Phone1", body?.phone1);
    if (typeof body?.email === "string" && body.email.trim()) {
      offer.EmailInformation = { EmailAddressTo: body.email.trim() };
    }

    // Delivery details
    applyString("DeliveryName", body?.deliveryName);
    applyString("DeliveryAddress1", body?.deliveryStreet);
    applyString("DeliveryAddress2", body?.deliveryAddress);
    applyString("DeliveryZipCode", body?.deliveryZip);
    applyString("DeliveryCity", body?.deliveryCity);
    applyString("DeliveryCountry", body?.deliveryCountry);

    const tenantId = typeof body?.tenantId === "string" && body.tenantId.trim()
      ? body.tenantId.trim()
      : undefined;

    const { documentNumber } = await createFortnoxQuote(offer, tenantId);

    return NextResponse.json({ ok: true, fortnox: { documentNumber } });
  } catch (error: any) {
    const message = error?.message ?? "Failed to create quote";
    const status = error?.status ?? 500;
    return NextResponse.json({ error: message }, { status });
  }
}
