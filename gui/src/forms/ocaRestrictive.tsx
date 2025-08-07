import React from "react";
import { Button } from "../components";

export const OcaRestrictivePopup: React.FC<{
  onAcknowledge: () => void;
  bannerText?: string | null;
}> = React.memo(({ onAcknowledge, bannerText }) => (
  <div className="fixed left-0 top-0 z-[2000] flex h-screen w-screen items-center justify-center bg-[rgba(0,0,0,0.25)]">
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="oca-popup-title"
      className="flex max-h-[80vh] w-[90%] max-w-[600px] flex-col rounded-[8px] border border-[#007acc] bg-[#252526] p-6 font-sans text-[13px] text-[#cccccc] shadow-[0_4px_24px_0_rgba(0,0,0,0.4)]"
    >
      <h2 id="oca-popup-title" className="mt-0 font-bold text-[#111]">
        Acknowledgement Required
      </h2>
      <h4 className="mb-2 font-semibold text-[#b3b3b3]">
        Disclaimer: Prohibited Data Submission
      </h4>
      <div className="mb-4 flex-1 overflow-y-auto pr-2 text-[13px] leading-[1.5] text-[#222] [mask-image:linear-gradient(to_bottom,black_96%,transparent_100%)]">
        {bannerText && (
          <div
            className="break-words bg-[#252526] text-[#222]"
            dangerouslySetInnerHTML={{ __html: bannerText }}
          />
        )}
      </div>
      <div className="text-right">
        <Button
          type="button"
          onClick={onAcknowledge}
          style={{
            background: "#0e639c",
            color: "#fff",
          }}
        >
          I acknowledge and agree
        </Button>
      </div>
    </div>
  </div>
));
