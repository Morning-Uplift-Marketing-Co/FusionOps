import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Check, ArrowRight } from "lucide-react";

const tiers = [
  { label: "Pay in 5", months: 5, apr: 0, badge: "BEST DEAL" },
  { label: "12 Months", months: 12, apr: 15.99 },
  { label: "24 Months", months: 24, apr: 18.99 },
  { label: "36 Months", months: 36, apr: 21.99 },
  { label: "48 Months", months: 48, apr: 27.99 },
  { label: "60 Months", months: 60, apr: 35.99 },
];

function calcPayment(principal: number, aprPercent: number, months: number) {
  if (aprPercent === 0) return principal / months;
  const r = aprPercent / 100 / 12;
  return (principal * r) / (1 - Math.pow(1 + r, -months));
}

function calcTotalPaid(monthly: number, months: number) {
  return monthly * months;
}

const Calculator = () => {
  const [amount, setAmount] = useState(5000);
  const [selectedTier, setSelectedTier] = useState(2); // default 24 months

  const formatted = amount.toLocaleString("en-US");

  // Compute all tier data
  const tierData = tiers.map((tier) => {
    const monthly = calcPayment(amount, tier.apr, tier.months);
    const totalPaid = calcTotalPaid(monthly, tier.months);
    const totalInterest = totalPaid - amount;
    return { ...tier, monthly, totalPaid, totalInterest };
  });

  const selected = tierData[selectedTier];

  return (
    <section className="bg-section-purple py-16 sm:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-10">
          <Badge className="mb-4 border-lion-gold/30 bg-lion-gold/10 text-lion-gold font-heading text-xs px-3 py-1 rounded-full">
            👑 LOAN CALCULATOR & APR COMPARISON
          </Badge>
          <h2 className="font-heading text-3xl font-bold text-foreground sm:text-4xl">
            Calculate Your Monthly Payment
          </h2>
          <p className="text-foreground/60 max-w-xl mx-auto mt-3 text-sm sm:text-base">
            Use our calculator to estimate monthly payments across different APR rates and repayment terms. Compare options side-by-side.
          </p>
        </div>

        {/* Loan Amount Slider */}
        <div className="mx-auto max-w-md mb-12">
          <p className="text-center text-sm text-muted-foreground mb-2 font-medium">Loan Amount</p>
          <p className="text-center text-4xl font-heading font-extrabold text-lion-gold mb-6">
            ${formatted}
          </p>
          <Slider
            value={[amount]}
            onValueChange={(v) => setAmount(v[0])}
            min={1000}
            max={25000}
            step={500}
            className="[&_[role=slider]]:bg-lion-gold [&_[role=slider]]:border-lion-gold [&_[data-orientation=horizontal]>.bg-primary]:bg-lion-gold"
          />
          <div className="flex justify-between text-xs text-muted-foreground mt-2">
            <span>$1,000</span>
            <span>$25,000</span>
          </div>
        </div>

        {/* Quick Tier Cards — top 3 */}
        <div className="mx-auto grid max-w-4xl gap-4 sm:grid-cols-3 mb-12">
          {tierData.slice(0, 3).map((tier, idx) => (
            <Card
              key={tier.label}
              onClick={() => setSelectedTier(idx)}
              className={`border-lion-gold/20 bg-foreground/5 backdrop-blur-sm relative cursor-pointer transition-all hover:border-lion-gold/40 ${
                selectedTier === idx ? "border-lion-gold/60 ring-2 ring-lion-gold/30" : ""
              } ${tier.badge ? "border-lion-gold/60 ring-1 ring-lion-gold/30" : ""}`}
            >
              {tier.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-lion-gold text-primary-foreground font-heading text-[10px] px-3 py-0.5 rounded-full">
                    {tier.badge}
                  </Badge>
                </div>
              )}
              <CardContent className="p-6 text-center pt-8">
                <p className="font-heading font-bold text-foreground text-lg">{tier.label}</p>
                <p className="text-3xl font-heading font-extrabold text-lion-gold mt-2">
                  ${tier.monthly.toFixed(0)}
                  <span className="text-sm font-normal text-muted-foreground">/mo</span>
                </p>
                <p className="text-xs text-muted-foreground mt-2">{tier.apr}% APR</p>
                <p className="text-[11px] text-foreground/40 mt-1">
                  Total: ${tier.totalPaid.toFixed(0)} · Interest: ${tier.totalInterest.toFixed(0)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* APR Comparison Table */}
        <div className="mx-auto max-w-4xl mb-10">
          <h3 className="font-heading text-xl font-bold text-foreground mb-6 text-center">
            Full APR Comparison Table
          </h3>
          <div className="rounded-xl border border-lion-gold/20 bg-foreground/5 backdrop-blur-sm overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-lion-gold/10 hover:bg-transparent">
                    <TableHead className="text-foreground/70 font-heading font-semibold">Term</TableHead>
                    <TableHead className="text-foreground/70 font-heading font-semibold text-center">APR</TableHead>
                    <TableHead className="text-foreground/70 font-heading font-semibold text-center">Monthly Payment</TableHead>
                    <TableHead className="text-foreground/70 font-heading font-semibold text-center">Total Interest</TableHead>
                    <TableHead className="text-foreground/70 font-heading font-semibold text-center">Total Repayable</TableHead>
                    <TableHead className="text-foreground/70 font-heading font-semibold text-center w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tierData.map((tier, idx) => (
                    <TableRow
                      key={tier.label}
                      onClick={() => setSelectedTier(idx)}
                      className={`border-lion-gold/10 cursor-pointer transition-colors hover:bg-lion-gold/5 ${
                        selectedTier === idx ? "bg-lion-gold/10" : ""
                      }`}
                    >
                      <TableCell className="font-heading font-semibold text-foreground">
                        <div className="flex items-center gap-2">
                          {tier.label}
                          {tier.badge && (
                            <Badge className="bg-lion-gold text-primary-foreground font-heading text-[9px] px-2 py-0 rounded-full">
                              {tier.badge}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-foreground/80">{tier.apr}%</TableCell>
                      <TableCell className="text-center font-semibold text-lion-gold">
                        ${tier.monthly.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center text-foreground/60">
                        ${tier.totalInterest.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center text-foreground/80">
                        ${tier.totalPaid.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-center">
                        {selectedTier === idx && (
                          <Check className="h-4 w-4 text-lion-gold mx-auto" />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        {/* Selected Plan Summary */}
        <div className="mx-auto max-w-2xl mb-10">
          <Card className="border-lion-gold/30 bg-foreground/5 backdrop-blur-sm">
            <CardContent className="p-6">
              <h4 className="font-heading font-bold text-foreground text-center mb-4">Your Selected Plan</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Loan Amount</p>
                  <p className="font-heading font-bold text-foreground text-lg">${formatted}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Monthly Payment</p>
                  <p className="font-heading font-bold text-lion-gold text-lg">${selected.monthly.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Interest</p>
                  <p className="font-heading font-bold text-foreground text-lg">${selected.totalInterest.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Total Repayable</p>
                  <p className="font-heading font-bold text-foreground text-lg">${selected.totalPaid.toFixed(2)}</p>
                </div>
              </div>
              <div className="text-center mt-4">
                <p className="text-xs text-muted-foreground">
                  {selected.label} at {selected.apr}% APR
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* CTA */}
        <div className="text-center mt-8">
          <a href="/apply">
            <Button className="rounded-xl bg-gradient-to-r from-lion-gold to-lion-gold-dark text-primary-foreground font-heading font-bold px-10 py-3.5 h-auto text-base hover:brightness-110 gap-2">
              Apply for ${formatted}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
          <p className="mt-3 text-xs text-muted-foreground">
            Checking eligibility won't affect your credit score
          </p>
          <div className="mx-auto mt-8 max-w-2xl rounded-lg border border-lion-gold/20 bg-foreground/5 p-4 text-xs text-muted-foreground text-center leading-relaxed">
            <span className="text-lion-gold font-medium">Representative Example:</span> A loan of ${formatted} at {selected.apr}% APR over {selected.months} months = {selected.months} monthly payments of ~${selected.monthly.toFixed(2)}. Total repayable: ${selected.totalPaid.toFixed(2)}. Total interest: ${selected.totalInterest.toFixed(2)}. Some lenders may charge origination or other fees.
          </div>
          <p className="mt-4 text-[11px] text-muted-foreground/60 max-w-xl mx-auto">
            These calculations are estimates only. Your actual rate, term, and monthly payment may differ based on your creditworthiness and the lender's criteria. APR ranges from 0% to 35.99%. Not all applicants will qualify for all rates shown.
          </p>
        </div>
      </div>
    </section>
  );
};

export default Calculator;
