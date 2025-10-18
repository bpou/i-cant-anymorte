"use client";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { MuseoModerno } from "next/font/google";
import Link from "next/link";
import { AnimatedSelect } from "@/components/AnimatedSelect"; // se till att sökvägen stämmer

/* -------------------- Typer -------------------- */
type Customer = {
  customerNumber: string;
  name: string;
  organisationNumber?: string;
  city?: string;
  email?: string;
  phone1?: string;
  invoiceName?: string;
  invoiceAddress1?: string;
  invoiceAddress2?: string;
  invoiceZip?: string;
  invoiceCity?: string;
  deliveryName?: string;
  deliveryStreet?: string;
  deliveryAddress?: string;
  deliveryZip?: string;
  deliveryCity?: string;
  priceList?: string;
};
type Article = { articleNumber: string; description: string; salesPrice?: number; unit?: string };
type Row = { articleNumber?: string; description?: string; OrderedQuantity: number; price: number; unit?: string };

type Option = { code: string; description?: string };

// Lokalt spår-typ (A–D)
type AppTrack = "A" | "B" | "C" | "D";

/* -------------------- Små UI-byggstenar (endast presentation) -------------------- */
function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-[12px] font-medium text-foreground/80">{label}</span>
      {children}
    </label>
  );
}
function TInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-7 w-full rounded-md border border-border bg-white/95 px-2 text-[13px] text-foreground",
        "placeholder:text-foreground/50 shadow-[inset_0_1px_0_rgba(0,0,0,.03)]",
        "focus:outline-none focus:ring-2 focus:ring-primary/25",
        props.className || "",
      ].join(" ")}
    />
  );
}
function Divider() {
  return <div className="my-4 h-px bg-border" />;
}
function SubTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="text-[12px] tracking-wide font-semibold text-foreground/80 uppercase">{children}</h2>;
}

// ✅ 1) Skapa font-instansen PÅ MODULNIVÅ
const museoModerno = MuseoModerno({
  subsets: ["latin"],
  weight: ["400", "700"],
});

/* -------------------- Sektion -------------------- */
function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
  useGrid = true,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  useGrid?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-1 py-2 text-left hover:bg-black/5 rounded-md"
      >
        <span className="text-[12px] tracking-wide font-semibold text-foreground/80 uppercase">
          {title}
        </span>
        <span className="text-[11px] text-foreground/60">{open ? "Dölj" : "Visa"}</span>
      </button>

      <div className="h-px bg-border" />

 <div
  className={[
    "transition-[max-height,opacity,margin] duration-300",
    open ? "opacity-100 mt-3 overflow-visible" : "opacity-0 max-h-0 mt-0 overflow-hidden",
  ].join(" ")}
  style={open ? undefined : { maxHeight: 0 }}
>

        {open && (
          <div className="rounded-lg border border-slate-300 bg-white p-4">
            {useGrid ? <div className="grid grid-cols-12 gap-3">{children}</div> : <>{children}</>}
          </div>
        )}
      </div>
    </section>
  );
}

export default function NNewOrderClient({ defaultOurReference = "" }: { defaultOurReference?: string }) {
  // Basfält
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");

  // Ordermeta (-> Fortnox)
  const [orderDate, setOrderDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [deliveryDate, setDeliveryDate] = useState<string>("");

  const [ourReference, setOurReference] = useState(() => defaultOurReference ?? "");
  const [yourReference, setYourReference] = useState("");

  // Prislista (dropdown)
  const [priceList, setPriceList] = useState<string>("");
  const [priceListOptions, setPriceListOptions] = useState<Option[]>([]);

  // Leveranssätt (dropdown)
  const [wayOfDelivery, setWayOfDelivery] = useState<string>("");
  const [wayOfDeliveryOptions, setWayOfDeliveryOptions] = useState<Option[]>([]);

  const [pricesInclVAT, setPricesInclVAT] = useState(false); // Fortnox: VATIncluded

  // Faktura-/kunduppgifter
  const [invoiceName, setInvoiceName] = useState("");
  const [invoiceAddress1, setInvoiceAddress1] = useState("");
  const [invoiceAddress2, setInvoiceAddress2] = useState("");
  const [invoiceZip, setInvoiceZip] = useState("");
  const [invoiceCity, setInvoiceCity] = useState("");
  const [organisationNumber, setOrganisationNumber] = useState("");
  const [phone1, setPhone1] = useState("");
  const [email, setEmail] = useState("");

  // Leveransadress
  const [deliveryAddress, setDeliveryAddress] = useState(""); // fri text -> DeliveryAddress2
  const [deliveryName, setDeliveryName] = useState("");
  const [deliveryStreet, setDeliveryStreet] = useState(""); // -> DeliveryAddress1
  const [deliveryZip, setDeliveryZip] = useState("");
  const [deliveryCity, setDeliveryCity] = useState("");

  // Tracks & planering (nu A–D)
  const [tracks, setTracks] = useState<AppTrack[]>(["A", "B"]);
  const [autoSchedule, setAutoSchedule] = useState(true);

  // Auto-estimat
  const [estimateA, setEstimateA] = useState<number>(60);
  const [estimateB, setEstimateB] = useState<number>(60);
  const [estimateC, setEstimateC] = useState<number>(60);
  const [estimateD, setEstimateD] = useState<number>(60);

  // Manuell tid per spår
  const [manualA, setManualA] = useState<{ start?: string; end?: string }>({});
  const [manualB, setManualB] = useState<{ start?: string; end?: string }>({});
  const [manualC, setManualC] = useState<{ start?: string; end?: string }>({});
  const [manualD, setManualD] = useState<{ start?: string; end?: string }>({});

  // Fortnox: kunder & artiklar
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customerNumber, setCustomerNumber] = useState<string>("");
  const selectedCustomer = useMemo(() => customers.find((c) => c.customerNumber === customerNumber), [customers, customerNumber]);

  const [articles, setArticles] = useState<Article[]>([]);
  const [articleQuery, setArticleQuery] = useState("");

  // Orderrader
  const [rows, setRows] = useState<Row[]>([{ OrderedQuantity: 1, price: 0 }]);

  // UI-state
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  /* -------------------- Datahämtning -------------------- */
  useEffect(() => {
    // kunder & artiklar
    fetch("/api/fortnox/customers")
      .then((r) => r.json())
      .then((j) => setCustomers(j.customers ?? []))
      .catch(() => {});
    fetch("/api/fortnox/articles")
      .then((r) => r.json())
      .then((j) => setArticles(j.articles ?? []))
      .catch(() => {});

    // leveranssätt + prislistor (tolerera olika nycklar i svaret)
    fetch("/api/fortnox/wayofdeliveries")
      .then((r) => r.json())
      .then((j) => setWayOfDeliveryOptions(j.wayOfDeliveries ?? j.items ?? []))
      .catch(() => {});
    fetch("/api/fortnox/pricelists")
      .then((r) => r.json())
      .then((j) => setPriceListOptions(j.priceLists ?? j.items ?? []))
      .catch(() => {});
  }, []);

  // Auto-fill kunduppgifter när kund väljs
  useEffect(() => {
    if (!selectedCustomer) return;

    setCustomerName(selectedCustomer.name ?? "");
    setInvoiceName(selectedCustomer.invoiceName ?? selectedCustomer.name ?? "");
    setInvoiceAddress1(selectedCustomer.invoiceAddress1 ?? "");
    setInvoiceAddress2(selectedCustomer.invoiceAddress2 ?? "");
    setInvoiceZip(selectedCustomer.invoiceZip ?? "");
    setInvoiceCity(selectedCustomer.invoiceCity ?? selectedCustomer.city ?? "");
    setOrganisationNumber(selectedCustomer.organisationNumber ?? "");
    setPhone1(selectedCustomer.phone1 ?? "");
    setEmail(selectedCustomer.email ?? "");
    setDeliveryName(selectedCustomer.deliveryName ?? selectedCustomer.name ?? "");
    setDeliveryStreet(selectedCustomer.deliveryStreet ?? "");
    setDeliveryAddress(selectedCustomer.deliveryAddress ?? "");
    setDeliveryZip(selectedCustomer.deliveryZip ?? "");
    setDeliveryCity(selectedCustomer.deliveryCity ?? selectedCustomer.city ?? "");
    if (selectedCustomer.priceList) {
      setPriceList(selectedCustomer.priceList);
    }
  }, [selectedCustomer]);

  // Autosätt första alternativet som default (om inget valt)
  useEffect(() => {
    if (!wayOfDelivery && wayOfDeliveryOptions.length) {
      setWayOfDelivery(wayOfDeliveryOptions[0].code);
    }
  }, [wayOfDeliveryOptions, wayOfDelivery]);
  useEffect(() => {
    if (!priceList && priceListOptions.length) {
      setPriceList(priceListOptions[0].code);
    }
  }, [priceListOptions, priceList]);

  const searchCustomers = async () => {
    const query = customerQuery.trim();
    const url = query ? `/api/fortnox/customers?q=${encodeURIComponent(query)}` : "/api/fortnox/customers";
    const res = await fetch(url);
    const j = await res.json();
    setCustomers(j.customers ?? []);
  };
  const searchArticles = async () => {
    const query = articleQuery.trim();
    const url = query ? `/api/fortnox/articles?articleNumber=${encodeURIComponent(query)}` : "/api/fortnox/articles";
    const res = await fetch(url);
    const j = await res.json();
    setArticles(j.articles ?? []);
  };

  /* -------------------- Rader utils -------------------- */
  const addRow = () => setRows((r) => [...r, { OrderedQuantity: 1, price: 0 }]);
  const removeRow = (i: number) => setRows((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, patch: Partial<Row>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

  const total = useMemo(() => rows.reduce((sum, r) => sum + (Number(r.price) || 0) * (Number(r.OrderedQuantity) || 0), 0), [rows]);

  /* -------------------- Submit -------------------- */
  async function submit() {
    setMsg(null);

    // Basvalidering
    if (!title.trim()) {
      setMsg("Titel krävs.");
      return;
    }
    if (!customerNumber) {
      setMsg("Välj kund (Fortnox).");
      return;
    }
    if (!tracks.length) {
      setMsg("Välj minst ett spår (A/B/C/D).");
      return;
    }

    if (!autoSchedule) {
      // Kräver manuell start & slut för alla valda spår
      if (tracks.includes("A") && !(manualA.start && manualA.end)) {
        setMsg("Ange manuell start/slut för Spår A eller slå på automatisk planering.");
        return;
      }
      if (tracks.includes("B") && !(manualB.start && manualB.end)) {
        setMsg("Ange manuell start/slut för Spår B eller slå på automatisk planering.");
        return;
      }
      if (tracks.includes("C") && !(manualC.start && manualC.end)) {
        setMsg("Ange manuell start/slut för Spår C eller slå på automatisk planering.");
        return;
      }
      if (tracks.includes("D") && !(manualD.start && manualD.end)) {
        setMsg("Ange manuell start/slut för Spår D eller slå på automatisk planering.");
        return;
      }
    }

    // Orderrader -> håll samma struktur som din backend förväntar sig (lowercase)
    const orderRows = rows.map((r) => ({
      articleNumber: r.articleNumber || undefined,
      description: r.description || title,
      OrderedQuantity: Number(r.OrderedQuantity || 1),
      price: Number(r.price || 0),
      unit: r.unit || "st",
    }));

    // Body till backend
    const body: any = {
      title,
      customerName,
      tracks,
      autoSchedule,
      customerNumber,
      orderRows,
      // leveransinfo (lokalt)
      deliveryAddress,
      deliveryName,
      deliveryStreet,
      deliveryZip,
      deliveryCity,
      // viktigt: detta sparas i din prisma.order.deliveryMethod i din POST-handler
      deliveryMethod: wayOfDelivery,
      // ev. använd på servern om du lägger till stöd
      priceList,
    };

    if (autoSchedule) {
      body.estimateA = tracks.includes("A") ? estimateA : undefined;
      body.estimateB = tracks.includes("B") ? estimateB : undefined;
      body.estimateC = tracks.includes("C") ? estimateC : undefined;
      body.estimateD = tracks.includes("D") ? estimateD : undefined;
    } else {
      body.manualA = tracks.includes("A") ? manualA : undefined;
      body.manualB = tracks.includes("B") ? manualB : undefined;
      body.manualC = tracks.includes("C") ? manualC : undefined;
      body.manualD = tracks.includes("D") ? manualD : undefined;
    }

    // Extra Fortnox-fält (om din backend läser body.fortnox)
    const frxRows = rows.map((r) => ({
      ArticleNumber: r.articleNumber || undefined,
      Description: r.description || title,
      OrderedQuantity: Number(r.OrderedQuantity || 1),
      Price: Number(r.price || 0),
      Unit: r.unit || "st",
    }));
    body.fortnox = {
      CustomerNumber: customerNumber,
      OrderDate: orderDate || undefined,
      DeliveryDate: deliveryDate || undefined,
      OurReference: ourReference || undefined,
      YourReference: yourReference || undefined,
      PriceList: priceList || undefined,
      VATIncluded: !!pricesInclVAT,

      CustomerName: invoiceName || undefined,
      Address1: invoiceAddress1 || undefined,
      Address2: invoiceAddress2 || undefined,
      ZipCode: invoiceZip || undefined,
      City: invoiceCity || undefined,
      OrganisationNumber: organisationNumber || undefined,
      Phone1: phone1 || undefined,

      EmailInformation: email ? { EmailAddressTo: email } : undefined,

      DeliveryName: deliveryName || undefined,
      DeliveryAddress1: deliveryStreet || undefined,
      DeliveryAddress2: deliveryAddress || undefined,
      DeliveryZipCode: deliveryZip || undefined,
      DeliveryCity: deliveryCity || undefined,
      WayOfDelivery: wayOfDelivery || undefined,

      Remarks: title || undefined,
      OrderRows: frxRows,
    };

    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) {
        const message = json?.error ?? json?.fortnoxError ?? json?.message ?? res.statusText ?? "okänt fel";
        setMsg("Fel: " + message);
        return;
      }

      const docNo: string | undefined =
        json?.documentNumber ?? json?.fortnox?.documentNumber ?? json?.order?.orderNumber;

      if (!docNo) {
        setMsg("Order skapad, men saknar Fortnox DocumentNumber i svaret.");
        return;
      }

      // Trigger ev. sync och gå till ordern
      fetch(`/api/orders/${encodeURIComponent(docNo)}/fortnox-sync`, { method: "POST" }).catch(() => {});
      window.location.href = `/orders/${encodeURIComponent(docNo)}`;
    } catch {
      setMsg("Tekniskt fel vid skapande av order.");
    } finally {
      setSubmitting(false);
    }
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="mx-auto max-w-[1100px] p-4 md:p-6">
      {/* Logga */}
      <div className="mb-6 flex justify-start"></div>

      <div className="mb-3 flex items-center justify-between">
        <h1 className={`${museoModerno.className} text-xl font-semibold`}>Ny order</h1>

        <div className="flex gap-3">
          <Link
            href="/orders/overview"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            VISA LISTA
          </Link>

          <button className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white text-slate-700 px-4 py-0.5 text-sm font-medium hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-300">
            <span className="text-lg">＋</span>
            SKAPA ORDER
          </button>
        </div>

        {submitting && <span className="text-[13px] text-foreground/60">Skapar order…</span>}
      </div>

      {/* Blankett-kort */}
      <div className="rounded-[12px] border border-border bg-card p-4 md:p-5 shadow-sm">
        {/* Översta raden: kund + datum */}
        <div className="grid grid-cols-12 gap-3">
          <Field label="Kund" className="col-span-12 sm:col-span-5">
            <div className="flex gap-2">
              <TInput
                placeholder="Sök kund…"
                value={customerQuery}
                onChange={(e) => setCustomerQuery(e.target.value)}
                className="flex-1"
              />
              <button
                type="button"
                onClick={searchCustomers}
                className="h-7 rounded-md border border-border bg-primary/10 px-3 text-[13px] text-primary hover:bg-primary/20"
              >
                Sök
              </button>
            </div>

            <AnimatedSelect
              value={customerNumber}
              onChange={setCustomerNumber}
              placeholder="— välj kund —"
              className="mt-2"
              options={customers.map((c) => ({
                value: c.customerNumber,
                label: `${c.customerNumber} — ${c.name}`,
                hint: c.city ? `(${c.city})` : undefined,
              }))}
            />
          </Field>

          <Field label="Orderdatum" className="col-span-6 sm:col-span-3">
            <TInput type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
          </Field>

          <Field label="Leveransdatum" className="col-span-6 sm:col-span-4">
            <TInput type="date" value={deliveryDate} onChange={(e) => setDeliveryDate(e.target.value)} />
          </Field>
        </div>

        {msg && (
          <div className="mt-3 rounded-md border border-danger/30 bg-danger/10 p-2 text-[13px] text-danger">
            {msg}
          </div>
        )}

        {/* ORDERUPPGIFTER */}
        <CollapsibleSection title="Orderuppgifter" defaultOpen>
          <Field label="Ordertitel" className="col-span-12 sm:col-span-6">
            <TInput value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Kundnamn (intern anteckning)" className="col-span-12 sm:col-span-6">
            <TInput value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
          </Field>
          <Field label="Vår referens" className="col-span-6 sm:col-span-3">
            <TInput value={ourReference} onChange={(e) => setOurReference(e.target.value)} />
          </Field>
          <Field label="Er referens" className="col-span-6 sm:col-span-3">
            <TInput value={yourReference} onChange={(e) => setYourReference(e.target.value)} />
          </Field>
          <Field label="Prislista" className="col-span-6 sm:col-span-3">
            <AnimatedSelect
              value={priceList}
              onChange={setPriceList}
              placeholder="— välj prislista —"
              options={priceListOptions.map((p) => ({
                value: p.code,
                label: p.code,
                hint: p.description,
              }))}
            />
          </Field>
          <Field label="Priser inkl. moms" className="col-span-6 sm:col-span-3">
            <AnimatedSelect
              value={String(pricesInclVAT)}
              onChange={(v) => setPricesInclVAT(v === "true")}
              placeholder="— välj —"
              options={[
                { value: "false", label: "Nej" },
                { value: "true", label: "Ja" },
              ]}
            />
          </Field>
        </CollapsibleSection>

        {/* KUNDUPPGIFTER */}
        <CollapsibleSection title="Kunduppgifter" defaultOpen={false}>
          <Field label="Namn" className="col-span-6 sm:col-span-3">
            <TInput value={invoiceName} onChange={(e) => setInvoiceName(e.target.value)} />
          </Field>
          <Field label="Fakturaadress" className="col-span-6 sm:col-span-4">
            <TInput value={invoiceAddress1} onChange={(e) => setInvoiceAddress1(e.target.value)} />
          </Field>
          <Field label="Postnr" className="col-span-6 sm:col-span-2">
            <TInput value={invoiceZip} onChange={(e) => setInvoiceZip(e.target.value)} />
          </Field>
          <Field label="Ort" className="col-span-6 sm:col-span-3">
            <TInput value={invoiceCity} onChange={(e) => setInvoiceCity(e.target.value)} />
          </Field>

          <Field label="Organisationsnummer" className="col-span-6 sm:col-span-3">
            <TInput value={organisationNumber} onChange={(e) => setOrganisationNumber(e.target.value)} />
          </Field>
          <Field label="Fakturaadress 2" className="col-span-6 sm:col-span-4">
            <TInput value={invoiceAddress2} onChange={(e) => setInvoiceAddress2(e.target.value)} />
          </Field>
          <Field label="Telefon" className="col-span-6 sm:col-span-2">
            <TInput value={phone1} onChange={(e) => setPhone1(e.target.value)} />
          </Field>
          <Field label="E-post" className="col-span-6 sm:col-span-3">
            <TInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </CollapsibleSection>

        {/* LEVERANSUPPGIFTER */}
        <CollapsibleSection title="Leveransuppgifter" defaultOpen={false}>
          <Field label="Namn" className="col-span-6 sm:col-span-3 ">
            <TInput value={deliveryName} onChange={(e) => setDeliveryName(e.target.value)} />
          </Field>
          <Field label="Leveransadress" className="col-span-6 sm:col-span-4">
            <TInput value={deliveryStreet} onChange={(e) => setDeliveryStreet(e.target.value)} />
          </Field>
          <Field label="Postnr" className="col-span-6 sm:col-span-2">
            <TInput value={deliveryZip} onChange={(e) => setDeliveryZip(e.target.value)} />
          </Field>
          <Field label="Ort" className="col-span-6 sm:col-span-3">
            <TInput value={deliveryCity} onChange={(e) => setDeliveryCity(e.target.value)} />
          </Field>

          <Field label="Leveransadress 2" className="col-span-12 sm:col-span-7">
            <TInput value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} placeholder="Fritt textfält" />
          </Field>

          <Field label="Leveranssätt " className="col-span-12 sm:col-span-5">
            <AnimatedSelect
              value={wayOfDelivery}
              onChange={setWayOfDelivery}
              placeholder="— välj leveranssätt —"
              options={wayOfDeliveryOptions.map((w) => ({
                value: w.code,
                label: w.code,
                hint: w.description,
              }))}
            />
          </Field>
          <Divider />
        </CollapsibleSection>

        {/* ORDERLINJER – kollapsbar sektion */}
        <CollapsibleSection title="Orderrader" defaultOpen>
          <div className="col-span-12 space-y-2">
            <div className="rounded-md border">
              <div className="grid grid-cols-12 bg-background/60 text-[12px] font-medium">
                <div className="col-span-2 border-r px-2 py-2">ARTIKELNR</div>
                <div className="col-span-5 border-r px-2 py-2">BENÄMNING</div>
                <div className="col-span-1 border-r px-2 py-2">ENHET</div>
                <div className="col-span-2 border-r px-2 py-2">À-PRIS</div>
                <div className="col-span-2 px-2 py-2">SUMMA</div>
              </div>

              {/* Artikel-sök */}
              <div className="border-t px-2 py-2">
                <div className="flex gap-2">
                  <TInput
                    placeholder="Sök artikelnr..."
                    value={articleQuery}
                    onChange={(e) => setArticleQuery(e.target.value)}
                    className="max-w-[300px]"
                  />
                  <button
                    type="button"
                    onClick={searchArticles}
                    className="h-7 rounded-md border border-border bg-primary/10 px-3 text-[13px] text-primary hover:bg-primary/20"
                  >
                    Sök
                  </button>
                </div>
              </div>

              {rows.map((row, i) => {
                const lineTotal = (Number(row.price) || 0) * (Number(row.OrderedQuantity) || 0);
                return (
                  <div key={i} className="grid grid-cols-12 border-t">
                    <div className="col-span-2 px-2 py-2">
                      <AnimatedSelect
                        value={row.articleNumber ?? ""}
                        onChange={(val) => {
                          const articleNumber = val || undefined;
                          const art = articles.find((a) => a.articleNumber === articleNumber);
                          updateRow(i, {
                            articleNumber,
                            description: art?.description ?? row.description,
                            price: typeof art?.salesPrice === "number" ? art.salesPrice : row.price,
                            unit: art?.unit ?? row.unit,
                          });
                        }}
                        placeholder="Artikel"
                        options={articles.map((a) => ({
                          value: a.articleNumber,
                          label: a.articleNumber,
                          hint: a.description,
                        }))}
                      />
                    </div>

                    <div className="col-span-5 px-2 py-2">
                      <TInput
                        placeholder="Beskrivning"
                        value={row.description ?? ""}
                        onChange={(e) => updateRow(i, { description: e.target.value })}
                      />
                    </div>

                    <div className="col-span-1 px-2 py-2">
                      <TInput placeholder="st" value={row.unit ?? "st"} onChange={(e) => updateRow(i, { unit: e.target.value })} />
                    </div>

                    <div className="col-span-2 px-2 py-2">
                      <div className="flex gap-2">
                        <TInput
                          type="number"
                          step="0.01"
                          placeholder="Pris"
                          value={row.price}
                          onChange={(e) => updateRow(i, { price: Number(e.target.value || 0) })}
                        />
                        <TInput
                          type="number"
                          placeholder="Antal"
                          value={row.OrderedQuantity}
                          onChange={(e) => updateRow(i, { OrderedQuantity: Number(e.target.value || 0) })}
                          className="w-[80px]"
                        />
                      </div>
                    </div>

                    <div className="col-span-2 px-2 py-2 flex items-center justify-between">
                      <span className="text-[13px]">
                        {lineTotal.toLocaleString("sv-SE", { style: "currency", currency: "SEK" })}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeRow(i)}
                        className="bg-rose-500 text-white rounded-xl px-3 py-1 text-xs font-medium hover:bg-rose-600 focus:outline-none focus:ring-2 focus:ring-rose-400"
                      >
                        Ta bort
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Lägg till rad + totals */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={addRow}
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500/50 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                + Lägg till rad
              </button>

              <div className="rounded-md border bg-card p-3 text-[13px]">
                <div className="flex justify-between gap-8">
                  <span>Nettobelopp</span>
                  <span className="font-semibold">
                    {total.toLocaleString("sv-SE", { style: "currency", currency: "SEK" })}
                  </span>
                </div>
                <div className="mt-2 border-t pt-2 flex justify-between font-semibold text-[14px]">
                  <span>Att betala</span>
                  <span>{total.toLocaleString("sv-SE", { style: "currency", currency: "SEK" })}</span>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Planering (lokal) */}
        <CollapsibleSection title="Planering" defaultOpen useGrid={false}>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-6 text-[13px]">
              <label className={`flex items-center gap-2 ${tracks.includes("A") ? "text-[color:var(--track-a)]" : ""}`}>
                <input
                  type="checkbox"
                  checked={tracks.includes("A")}
                  onChange={(e) =>
                    setTracks((p) => (e.target.checked ? Array.from(new Set([...p, "A"])) : p.filter((x) => x !== "A")))
                  }
                />
                Spår A
              </label>

              <label className={`flex items-center gap-2 ${tracks.includes("B") ? "text-[color:var(--track-b)]" : ""}`}>
                <input
                  type="checkbox"
                  checked={tracks.includes("B")}
                  onChange={(e) =>
                    setTracks((p) => (e.target.checked ? Array.from(new Set([...p, "B"])) : p.filter((x) => x !== "B")))
                  }
                />
                Spår B
              </label>

              <label className={`flex items-center gap-2 ${tracks.includes("C") ? "text-brand-600" : ""}`}>
                <input
                  type="checkbox"
                  checked={tracks.includes("C")}
                  onChange={(e) =>
                    setTracks((p) => (e.target.checked ? Array.from(new Set([...p, "C"])) : p.filter((x) => x !== "C")))
                  }
                />
                Spår C
              </label>

              <label className={`flex items-center gap-2 ${tracks.includes("D") ? "text-brand-600" : ""}`}>
                <input
                  type="checkbox"
                  checked={tracks.includes("D")}
                  onChange={(e) =>
                    setTracks((p) => (e.target.checked ? Array.from(new Set([...p, "D"])) : p.filter((x) => x !== "D")))
                  }
                />
                Spår D
              </label>

              <label className="flex items-center gap-2">
                <input type="checkbox" checked={autoSchedule} onChange={(e) => setAutoSchedule(e.target.checked)} />
                Planera automatiskt (07–16)
              </label>
            </div>

            {autoSchedule ? (
              <div className="grid grid-cols-2 gap-3">
                {tracks.includes("A") && (
                  <Field label="Uppskattad tid A (minuter)">
                    <TInput type="number" value={estimateA} onChange={(e) => setEstimateA(Number(e.target.value || 0))} />
                  </Field>
                )}
                {tracks.includes("B") && (
                  <Field label="Uppskattad tid B (minuter)">
                    <TInput type="number" value={estimateB} onChange={(e) => setEstimateB(Number(e.target.value || 0))} />
                  </Field>
                )}
                {tracks.includes("C") && (
                  <Field label="Uppskattad tid C (minuter)">
                    <TInput type="number" value={estimateC} onChange={(e) => setEstimateC(Number(e.target.value || 0))} />
                  </Field>
                )}
                {tracks.includes("D") && (
                  <Field label="Uppskattad tid D (minuter)">
                    <TInput type="number" value={estimateD} onChange={(e) => setEstimateD(Number(e.target.value || 0))} />
                  </Field>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {tracks.includes("A") && (
                  <Field label="Manuell tid – Spår A">
                    <div className="flex gap-2">
                      <TInput
                        placeholder="Start (ISO)"
                        value={manualA.start ?? ""}
                        onChange={(e) => setManualA((s) => ({ ...s, start: e.target.value }))}
                      />
                      <TInput
                        placeholder="Slut (ISO)"
                        value={manualA.end ?? ""}
                        onChange={(e) => setManualA((s) => ({ ...s, end: e.target.value }))}
                      />
                    </div>
                  </Field>
                )}
                {tracks.includes("B") && (
                  <Field label="Manuell tid – Spår B">
                    <div className="flex gap-2">
                      <TInput
                        placeholder="Start (ISO)"
                        value={manualB.start ?? ""}
                        onChange={(e) => setManualB((s) => ({ ...s, start: e.target.value }))}
                      />
                      <TInput
                        placeholder="Slut (ISO)"
                        value={manualB.end ?? ""}
                        onChange={(e) => setManualB((s) => ({ ...s, end: e.target.value }))}
                      />
                    </div>
                  </Field>
                )}
                {tracks.includes("C") && (
                  <Field label="Manuell tid – Spår C">
                    <div className="flex gap-2">
                      <TInput
                        placeholder="Start (ISO)"
                        value={manualC.start ?? ""}
                        onChange={(e) => setManualC((s) => ({ ...s, start: e.target.value }))}
                      />
                      <TInput
                        placeholder="Slut (ISO)"
                        value={manualC.end ?? ""}
                        onChange={(e) => setManualC((s) => ({ ...s, end: e.target.value }))}
                      />
                    </div>
                  </Field>
                )}
                {tracks.includes("D") && (
                  <Field label="Manuell tid – Spår D">
                    <div className="flex gap-2">
                      <TInput
                        placeholder="Start (ISO)"
                        value={manualD.start ?? ""}
                        onChange={(e) => setManualD((s) => ({ ...s, start: e.target.value }))}
                      />
                      <TInput
                        placeholder="Slut (ISO)"
                        value={manualD.end ?? ""}
                        onChange={(e) => setManualD((s) => ({ ...s, end: e.target.value }))}
                      />
                    </div>
                  </Field>
                )}
              </div>
            )}
          </div>
        </CollapsibleSection>

        {/* Actions */}
        <div className="mt-5 flex items-center justify-end">
          <button
            onClick={submit}
            disabled={submitting}
            className="inline-flex items-center justify-center rounded-xl bg-emerald-500 text-white px-4 py-2 text-sm font-medium hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          >
            Skapa order
          </button>
        </div>
      </div>
    </div>
  );
}
