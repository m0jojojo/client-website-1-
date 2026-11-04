import { siteConfig } from "@/lib/site";

export function WhatsAppButton() {
  const href = `https://wa.me/${siteConfig.whatsappNumber}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className="whatsapp-fab bg-whatsapp fixed right-4 bottom-4 z-50 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-lg transition-transform hover:scale-105"
    >
      <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.2 14c-.2.6-1.300 1.200-1.800 1.200-.5.1-1 .2-3.300-.7-2.800-1.100-4.600-4-4.700-4.200-.1-.2-1.100-1.500-1.100-2.800 0-1.300.7-2 .9-2.300.3-.3.600-.3.800-.3h.6c.2 0 .4 0 .6.500l.8 2c.1.2.1.400 0 .5l-.4.600-.3.400c-.1.100-.3.300-.1.600.2.300.8 1.300 1.700 2.100 1.200 1 2.100 1.300 2.400 1.500.3.100.5.100.6-.1l.9-1.100c.2-.3.400-.2.600-.1l1.900.9c.3.100.5.200.5.300.1.200.1.800-.2 1.400Z" />
      </svg>
    </a>
  );
}
