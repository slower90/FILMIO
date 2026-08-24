import { Instagram, Youtube, Facebook, Twitter, Music2, QrCode } from "lucide-react";

export default function MadMaxFooter() {
  return (
    <footer className="w-full bg-black text-white pt-14 pb-8 px-6 font-sans">
      {/* Sign in CTA */}
      <div className="flex justify-center mb-10">
        <button className="bg-gradient-to-r from-[#E63946] to-[#B5121B] hover:from-[#F04452] hover:to-[#C81824] transition-colors text-white font-bold text-sm px-6 py-2.5 rounded-full tracking-wide">
          Sign in for more access
        </button>
      </div>

      {/* Social + App boxes */}
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
        <div className="border border-neutral-700 rounded-xl p-6 flex flex-col items-center gap-4">
          <p className="font-bold text-sm tracking-wide">Follow MAD MAX on social</p>
          <div className="flex gap-5 text-neutral-200">
            <Music2 className="w-5 h-5 hover:text-[#E63946] cursor-pointer transition-colors" />
            <Instagram className="w-5 h-5 hover:text-[#E63946] cursor-pointer transition-colors" />
            <Twitter className="w-5 h-5 hover:text-[#E63946] cursor-pointer transition-colors" />
            <Youtube className="w-5 h-5 hover:text-[#E63946] cursor-pointer transition-colors" />
            <Facebook className="w-5 h-5 hover:text-[#E63946] cursor-pointer transition-colors" />
          </div>
        </div>

        <div className="border border-neutral-700 rounded-xl p-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-sm">Get the MAD MAX app</p>
            <p className="text-neutral-400 text-sm">For Android and iOS</p>
          </div>
          <div className="w-16 h-16 bg-white rounded flex items-center justify-center shrink-0">
            <QrCode className="w-11 h-11 text-black" />
          </div>
        </div>
      </div>

      {/* Link rows */}
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-300 mb-2">
        <a href="#" className="hover:underline hover:text-white">Help</a>
        <a href="#" className="hover:underline hover:text-white">Site Index</a>
        <a href="#" className="hover:underline hover:text-white">Actor Directory</a>
        <a href="#" className="hover:underline hover:text-white">Advertising</a>
        <a href="#" className="hover:underline hover:text-white">License Our Data</a>
      </div>
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-neutral-300 mb-10">
        <a href="#" className="hover:underline hover:text-white">Press Room</a>
        <a href="#" className="hover:underline hover:text-white">Jobs</a>
        <a href="#" className="hover:underline hover:text-white">Conditions of Use</a>
        <a href="#" className="hover:underline hover:text-white">Privacy Policy</a>
        <span className="flex items-center gap-1">
          <span className="bg-blue-600 text-[10px] font-bold rounded px-1 py-0.5">✓✕</span>
          Your Ads Privacy Choices
        </span>
      </div>

      {/* Bottom */}
      <div className="flex flex-col items-center gap-1 text-neutral-500 text-xs">
        <p className="text-neutral-300 text-sm">
          part of the <span className="font-bold text-white">Vishnuva</span> group
        </p>
        <p>© 1990-2026 by MAD MAX, Inc.</p>
      </div>
    </footer>
  );
}
