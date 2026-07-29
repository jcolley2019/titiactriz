import { useLayoutEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { supabase } from "@/integrations/supabase/client";

gsap.registerPlugin(ScrollTrigger);

// Same schema as HomeEditorial's contact form.
const contactSchema = z.object({
  name: z.string().trim().min(2, { message: "Name must be at least 2 characters" }).max(100, { message: "Name must be less than 100 characters" }),
  email: z.string().trim().email({ message: "Please enter a valid email address" }).max(255, { message: "Email must be less than 255 characters" }),
  message: z.string().trim().min(10, { message: "Message must be at least 10 characters" }).max(1000, { message: "Message must be less than 1000 characters" }),
});
type ContactFormData = z.infer<typeof contactSchema>;

/**
 * TA.4 contact — cinematic restyle of the editorial contact section. The
 * submission logic is reused EXACTLY from HomeEditorial: persist via the
 * send-contact edge function, then best-effort notify via Formspree.
 *
 * REVIEW.3a — contact joined the uniform dwell law: like the gallery and
 * About it pins for +=120% before the footer reveals. The pin holds the
 * section's place only — the form stays fully usable through the dwell
 * (click, focus, type, submit), because a pinned element keeps its pointer
 * events. The FOOTER itself never pins (still ruled). Reduced motion skips
 * the pin entirely.
 */
const CinematicContact = ({ reduced }: { reduced: boolean }) => {
  const { t } = useTranslation();
  const sectionRef = useRef<HTMLElement>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useLayoutEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=120%",
        pin: true,
        anticipatePin: 1,
      });
    }, sectionRef);
    return () => ctx.revert();
  }, [reduced]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ContactFormData>({ resolver: zodResolver(contactSchema) });

  const onSubmit = async (data: ContactFormData) => {
    setIsSubmitting(true);
    try {
      const { data: responseData, error } = await supabase.functions.invoke("send-contact", {
        body: { type: "general", name: data.name, email: data.email, message: data.message },
      });
      if (error || responseData?.error) {
        alert(responseData?.error || "There was an error sending your message. Please try again.");
        return;
      }
      try {
        await fetch("https://formspree.io/f/maqzwogl", {
          method: "POST",
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: JSON.stringify({
            name: data.name,
            email: data.email,
            message: data.message,
            _subject: `New contact form submission from ${data.name}`,
          }),
        });
      } catch {}
      setSubmitSuccess(true);
      reset();
      setTimeout(() => setSubmitSuccess(false), 3000);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (hasError: boolean) =>
    `w-full h-12 px-4 rounded-none border bg-[#12100c]/70 text-[#f0e9da] placeholder:text-[#f0e9da]/40 focus:outline-none focus:ring-1 focus:ring-[#C9A55C] ${
      hasError ? "border-destructive" : "border-[#C9A55C]/30"
    }`;

  return (
    <section
      ref={sectionRef}
      id="contact"
      data-qa="cinematic-section"
      className="relative px-6 py-24 md:py-32"
      style={{ backgroundColor: "#0e0c09" }}
    >
      <div className="mx-auto max-w-2xl text-center">
        <p className="text-caps mb-4" style={{ color: "#C9A55C" }}>
          {t("contact.eyebrow")}
        </p>
        <h2
          data-qa="section-heading"
          className="mb-4"
          style={{ fontFamily: "var(--font-display)", color: "#f4ecdb", fontSize: "clamp(2rem, 5vw, 3.5rem)" }}
        >
          {t("contact.title")}
        </h2>
        <p className="mb-8" style={{ color: "rgba(240,233,218,0.7)", fontFamily: "var(--font-sans)", fontWeight: 300 }}>
          {t("contact.subtitle")}
        </p>

        <div className="mb-10">
          <a
            href="mailto:hola@titiactriz.com"
            className="text-2xl md:text-3xl transition-colors duration-300 hover:text-[#C9A55C]"
            style={{ fontFamily: "var(--font-display)", color: "#f4ecdb" }}
          >
            hola@titiactriz.com
          </a>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 text-left">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="cine-name" className="mb-2 block text-sm font-medium text-[#f0e9da]">
                {t("contact.form.name")}
              </label>
              <input
                type="text"
                id="cine-name"
                {...register("name")}
                className={inputClass(!!errors.name)}
                placeholder={t("contact.form.namePlaceholder")}
              />
              {errors.name && <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div>
              <label htmlFor="cine-email" className="mb-2 block text-sm font-medium text-[#f0e9da]">
                {t("contact.form.email")}
              </label>
              <input
                type="email"
                id="cine-email"
                {...register("email")}
                className={inputClass(!!errors.email)}
                placeholder={t("contact.form.emailPlaceholder")}
              />
              {errors.email && <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>}
            </div>
          </div>
          <div>
            <label htmlFor="cine-message" className="mb-2 block text-sm font-medium text-[#f0e9da]">
              {t("contact.form.message")}
            </label>
            <textarea
              id="cine-message"
              {...register("message")}
              rows={5}
              className={`w-full resize-none rounded-none border bg-[#12100c]/70 px-4 py-3 text-[#f0e9da] placeholder:text-[#f0e9da]/40 focus:outline-none focus:ring-1 focus:ring-[#C9A55C] ${
                errors.message ? "border-destructive" : "border-[#C9A55C]/30"
              }`}
              placeholder={t("contact.form.messagePlaceholder")}
            />
            {errors.message && <p className="mt-1 text-xs text-destructive">{errors.message.message}</p>}
          </div>

          {submitSuccess && (
            <div
              className="rounded-none border p-4 text-sm"
              style={{ borderColor: "rgba(201,165,92,0.5)", backgroundColor: "rgba(201,165,92,0.12)", color: "#f0e9da" }}
            >
              {t("contact.form.success") || "Thank you! Your message has been received."}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center px-8 py-3 text-xs uppercase tracking-[0.2em] font-medium transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-60"
            style={{ backgroundColor: "#C9A55C", color: "#0e0c09" }}
          >
            {isSubmitting ? t("contact.form.sending") || "Sending..." : t("contact.form.submit")}
          </button>
        </form>
      </div>
    </section>
  );
};

export default CinematicContact;
