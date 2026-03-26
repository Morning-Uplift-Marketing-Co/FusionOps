import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const zipSchema = z.object({
  zip: z.string().length(5, "Enter a valid 5-digit ZIP code").regex(/^\d{5}$/, "ZIP code must be 5 digits"),
});

type ZipFormData = z.infer<typeof zipSchema>;

const ZipForm = () => {
  const [status, setStatus] = useState<"idle" | "loading" | "success">("idle");
  const [submittedZip, setSubmittedZip] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ZipFormData>({
    resolver: zodResolver(zipSchema),
  });

  const onSubmit = (data: ZipFormData) => {
    setStatus("loading");
    setSubmittedZip(data.zip);
    setTimeout(() => setStatus("success"), 2000);
  };

  if (status === "success") {
    return (
      <div className="text-center py-4">
        <p className="text-lion-gold font-heading font-semibold text-lg animate-pulse">
          ✨ Searching premium offers for {submittedZip}...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3 sm:flex-row sm:items-start">
      <div className="flex-1">
        <input
          {...register("zip")}
          placeholder="Enter ZIP Code"
          maxLength={5}
          className="w-full rounded-xl border border-foreground/30 bg-foreground/10 px-4 py-3.5 text-foreground placeholder:text-foreground/60 backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-lion-gold text-base"
        />
        {errors.zip && (
          <p className="mt-1.5 text-sm text-lion-gold">{errors.zip.message}</p>
        )}
      </div>
      <Button
        type="submit"
        disabled={status === "loading"}
        className="rounded-xl bg-gradient-to-r from-lion-gold to-lion-gold-dark text-primary-foreground font-heading font-bold px-8 py-3.5 h-auto text-base hover:brightness-110 transition-all disabled:opacity-70"
      >
        {status === "loading" ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Unlocking...
          </>
        ) : (
          "Unlock My Offers →"
        )}
      </Button>
    </form>
  );
};

export default ZipForm;
