import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Rate limiting: Track submissions by IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 5; // Max submissions per window
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// Input validation limits
const MAX_NAME_LENGTH = 100;
const MAX_EMAIL_LENGTH = 255;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_PHONE_LENGTH = 20;
const MAX_TIKTOK_LENGTH = 50;

// Sanitize string input - remove control characters and limit length
function sanitizeString(input: string, maxLength: number): string {
  if (typeof input !== "string") return "";
  // Remove control characters except newlines and tabs for messages
  const sanitized = input
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .trim();
  return sanitized.slice(0, maxLength);
}

// Validate email format
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= MAX_EMAIL_LENGTH;
}

// Validate phone format (basic - allows digits, spaces, +, -, parentheses)
function isValidPhone(phone: string): boolean {
  if (!phone) return true; // Phone can be optional
  const phoneRegex = /^[\d\s+\-()]+$/;
  return phoneRegex.test(phone) && phone.length <= MAX_PHONE_LENGTH;
}

// Check rate limit for IP
function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitMap.get(ip);

  if (!record || now > record.resetTime) {
    rateLimitMap.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

interface ContactRequest {
  type: "general" | "titans";
  name: string;
  email: string;
  message?: string;
  phone?: string;
  tiktokHandle?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    // Get client IP for rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
               req.headers.get("cf-connecting-ip") || 
               "unknown";

    // Check rate limit
    const { allowed, remaining } = checkRateLimit(ip);
    if (!allowed) {
      return new Response(
        JSON.stringify({ 
          error: "Too many requests. Please try again later.",
          retryAfter: RATE_WINDOW / 1000 
        }),
        {
          status: 429,
          headers: { 
            "Content-Type": "application/json", 
            "X-RateLimit-Remaining": "0",
            "Retry-After": String(RATE_WINDOW / 1000),
            ...corsHeaders 
          },
        }
      );
    }

    // Parse and validate request body
    let body: ContactRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { type, name, email, message, phone, tiktokHandle } = body;

    // Validate required fields
    const errors: Record<string, string> = {};

    // Validate type
    if (!type || !["general", "titans"].includes(type)) {
      errors.type = "Invalid form type";
    }

    // Validate and sanitize name
    const sanitizedName = sanitizeString(name || "", MAX_NAME_LENGTH);
    if (!sanitizedName || sanitizedName.length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    // Validate and sanitize email
    const sanitizedEmail = sanitizeString(email || "", MAX_EMAIL_LENGTH);
    if (!sanitizedEmail || !isValidEmail(sanitizedEmail)) {
      errors.email = "Please enter a valid email address";
    }

    // Type-specific validation
    if (type === "general") {
      // General contact form requires message
      const sanitizedMessage = sanitizeString(message || "", MAX_MESSAGE_LENGTH);
      if (!sanitizedMessage || sanitizedMessage.length < 10) {
        errors.message = "Message must be at least 10 characters";
      }
    } else if (type === "titans") {
      // Titans form requires phone
      const sanitizedPhone = sanitizeString(phone || "", MAX_PHONE_LENGTH);
      if (!sanitizedPhone) {
        errors.phone = "Phone number is required";
      } else if (!isValidPhone(sanitizedPhone)) {
        errors.phone = "Please enter a valid phone number";
      }
    }

    // Return validation errors if any
    if (Object.keys(errors).length > 0) {
      return new Response(JSON.stringify({ error: "Validation failed", errors }), {
        status: 400,
        headers: { 
          "Content-Type": "application/json", 
          "X-RateLimit-Remaining": String(remaining),
          ...corsHeaders 
        },
      });
    }

    // Sanitize all inputs for storage/forwarding
    const sanitizedData = {
      type,
      name: sanitizedName,
      email: sanitizedEmail,
      message: type === "general" ? sanitizeString(message || "", MAX_MESSAGE_LENGTH) : undefined,
      phone: type === "titans" ? sanitizeString(phone || "", MAX_PHONE_LENGTH) : undefined,
      tiktokHandle: tiktokHandle ? sanitizeString(tiktokHandle, MAX_TIKTOK_LENGTH) : undefined,
      submittedAt: new Date().toISOString(),
      ip: ip !== "unknown" ? ip.slice(0, 45) : undefined, // Store truncated IP for abuse prevention
    };

    // Log submission (in production, you'd send to email service like Loops.so or store in database)
    console.log("Contact form submission received:", {
      type: sanitizedData.type,
      name: sanitizedData.name,
      email: sanitizedData.email,
      hasMessage: !!sanitizedData.message,
      hasPhone: !!sanitizedData.phone,
      hasTiktok: !!sanitizedData.tiktokHandle,
      timestamp: sanitizedData.submittedAt,
    });

    // TODO: Integrate with email service (Loops.so, SendGrid, Resend, etc.)
    // Example with Loops.so:
    // const loopsApiKey = Deno.env.get("LOOPS_API_KEY");
    // if (loopsApiKey) {
    //   await fetch("https://app.loops.so/api/v1/transactional", {
    //     method: "POST",
    //     headers: {
    //       "Authorization": `Bearer ${loopsApiKey}`,
    //       "Content-Type": "application/json",
    //     },
    //     body: JSON.stringify({
    //       transactionalId: "contact-notification",
    //       email: "your-email@domain.com",
    //       dataVariables: sanitizedData,
    //     }),
    //   });
    // }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Your message has been received. We'll get back to you soon!" 
      }),
      {
        status: 200,
        headers: { 
          "Content-Type": "application/json", 
          "X-RateLimit-Remaining": String(remaining),
          ...corsHeaders 
        },
      }
    );
  } catch (error) {
    console.error("Error processing contact form:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
