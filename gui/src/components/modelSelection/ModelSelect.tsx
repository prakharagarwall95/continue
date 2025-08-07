import {
  ArrowPathIcon,
  CheckIcon,
  ChevronDownIcon,
  Cog6ToothIcon,
  CubeIcon,
  PlusIcon,
} from "@heroicons/react/24/outline";
import { useContext, useEffect, useRef, useState } from "react";
import { useAuth } from "../../context/Auth";
import { IdeMessengerContext } from "../../context/IdeMessenger";
import { AddModelForm } from "../../forms/AddModelForm";
import { useAppDispatch, useAppSelector } from "../../redux/hooks";
import { EMPTY_CONFIG } from "../../redux/slices/configSlice";
import { setDialogMessage, setShowDialog } from "../../redux/slices/uiSlice";
import { updateSelectedModelByRole } from "../../redux/thunks/updateSelectedModelByRole";
import {
  fontSize,
  getMetaKeyLabel,
  isMetaEquivalentKeyPressed,
} from "../../util";
import {
  Listbox,
  ListboxButton,
  ListboxOption,
  ListboxOptions,
} from "../ui/Listbox";
import { OcaRestrictivePopup } from "../../forms/ocaRestrictive";

interface ModelOptionProps {
  option: Option;
  idx: number;
  showMissingApiKeyMsg: boolean;
  isSelected?: boolean;
}

interface Option {
  value: string;
  title: string;
  apiKey?: string;
  sourceFile?: string;
}

function modelSelectTitle(model: any): string {
  if (model?.title) return model?.title;
  if (model?.model !== undefined && model?.model.trim() !== "") {
    if (model?.class_name) {
      return `${model?.class_name} - ${model?.model}`;
    }
    return model?.model;
  }
  return model?.class_name;
}

function ModelOption({
  option,
  idx,
  showMissingApiKeyMsg,
  isSelected,
}: ModelOptionProps) {
  function handleOptionClick(e: any) {
    if (showMissingApiKeyMsg) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  function requiresConfirmation(modelTitle: string) {
    const name = modelTitle.toLowerCase();
    return name.includes("openai") || name.includes("gpt");
  }

  return (
    <ListboxOption
      key={idx}
      disabled={showMissingApiKeyMsg}
      value={option.value}
      onClick={handleOptionClick}
    >
      <div className="flex w-full items-center justify-between">
        <div className="flex items-center gap-2">
          <CubeIcon className="h-3 w-3 flex-shrink-0" />
          <span className="line-clamp-1">
            {option.title}
            {showMissingApiKeyMsg && (
              <span className="ml-2 text-[10px] italic">(Missing API key)</span>
            )}
          </span>
        </div>
        <CheckIcon
          className={`h-3 w-3 flex-shrink-0 ${isSelected ? "" : "invisible"}`}
        />
      </div>
    </ListboxOption>
  );
}

function ModelSelect() {
  const dispatch = useAppDispatch();

  const isInEdit = useAppSelector((store) => store.session.isInEdit);
  const config = useAppSelector((state) => state.config.config);
  const ideMessenger = useContext(IdeMessengerContext);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [sortedOptions, setSortedOptions] = useState<Option[]>([]);
  const { selectedProfile } = useAuth();
  const [pendingModel, setPendingModel] = useState<Option | null>(null);
  const [showPopup, setShowPopup] = useState(false);

  let selectedModel = null;
  let allModels = null;
  if (isInEdit) {
    allModels = config.modelsByRole.edit;
    selectedModel = config.selectedModelByRole.edit;
  }
  if (!selectedModel) {
    selectedModel = config.selectedModelByRole.chat;
  }
  if (!allModels || allModels.length === 0) {
    allModels = config.modelsByRole.chat;
  }

  function requiresConfirmation(modelTitle: string) {
    const name = modelTitle.toLowerCase();
    return name.includes("openai") || name.includes("gpt");
  }

  // CHANGED onChange handler
  const handleModelChange = async (val: string) => {
    if (val === selectedModel?.title) return;
    const picked = options.find((opt) => opt.value === val);
    if (picked && requiresConfirmation(picked.title)) {
      setPendingModel(picked);
      setShowPopup(true); // Show confirmation dialog
      return;
    }
    // If no confirmation needed, just switch model
    void dispatch(
      updateSelectedModelByRole({
        selectedProfile,
        role: isInEdit ? "edit" : "chat",
        modelTitle: val,
      }),
    );
  };

  // Confirmation popup handlers
  const handleConfirm = () => {
    if (pendingModel) {
      void dispatch(
        updateSelectedModelByRole({
          selectedProfile,
          role: isInEdit ? "edit" : "chat",
          modelTitle: pendingModel.value,
        }),
      );
      setPendingModel(null);
    }
    setShowPopup(false);
  };

  const handleCancel = () => {
    setPendingModel(null);
    setShowPopup(false);
  };

  // Sort so that options without an API key are at the end
  useEffect(() => {
    const alphaSort = options.sort((a, b) => a.title.localeCompare(b.title));
    const enabledOptions = alphaSort.filter((option) => option.apiKey !== "");
    const disabledOptions = alphaSort.filter((option) => option.apiKey === "");

    const sorted = [...enabledOptions, ...disabledOptions];

    setSortedOptions(sorted);
  }, [options]);

  useEffect(() => {
    setOptions(
      allModels.map((model) => {
        return {
          value: model.title,
          title: modelSelectTitle(model),
          apiKey: model.apiKey,
          sourceFile: model.sourceFile,
        };
      }),
    );
  }, [config]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === "'" &&
        isMetaEquivalentKeyPressed(event as any) &&
        !event.shiftKey // To prevent collisions w/ assistant toggle logic
      ) {
        if (!selectedProfile) {
          return;
        }

        const direction = event.shiftKey ? -1 : 1;
        const currentIndex = options.findIndex(
          (option) => option.value === selectedModel?.title,
        );
        let nextIndex = (currentIndex + 1 * direction) % options.length;
        if (nextIndex < 0) nextIndex = options.length - 1;
        const newModelTitle = options[nextIndex].value;

        void dispatch(
          updateSelectedModelByRole({
            selectedProfile,
            role: "chat",
            modelTitle: newModelTitle,
          }),
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [options, selectedModel]);

  function onClickAddModel(e: MouseEvent) {
    e.stopPropagation();
    e.preventDefault();

    // Close the dropdown
    if (buttonRef.current) {
      buttonRef.current.click();
    }
    dispatch(setShowDialog(true));
    dispatch(
      setDialogMessage(
        <AddModelForm
          onDone={() => {
            dispatch(setShowDialog(false));
          }}
        />,
      ),
    );
  }

  const isConfigLoading = config === EMPTY_CONFIG;
  const hasNoModels = allModels?.length === 0;

  return (
    <Listbox onChange={handleModelChange}>
      <div className="relative flex">
        <ListboxButton
          data-testid="model-select-button"
          ref={buttonRef}
          className="text-description h-[18px] gap-1 border-none"
        >
          <span className="line-clamp-1 break-all hover:brightness-110">
            {modelSelectTitle(selectedModel) || "Select model"}
          </span>
          <ChevronDownIcon
            className="hidden h-2 w-2 flex-shrink-0 hover:brightness-110 min-[200px]:flex"
            aria-hidden="true"
          />
        </ListboxButton>
        <ListboxOptions className="min-w-[160px]">
          <div className="flex items-center justify-between gap-1 px-2 py-1">
            <span className="font-semibold">Models</span>
            <Cog6ToothIcon
              className="text-description h-3 w-3 cursor-pointer hover:brightness-125"
              onClick={() =>
                ideMessenger.post("config/openProfile", {
                  profileId: undefined,
                  element: { sourceFile: selectedModel?.sourceFile },
                })
              }
            />
          </div>

          <div className="no-scrollbar max-h-[300px] overflow-y-auto">
            {isConfigLoading ? (
              <div className="text-description flex items-center gap-2 px-2 pb-2 pt-1 text-xs">
                <ArrowPathIcon className="animate-spin-slow h-3 w-3" />
                <span>Loading config</span>
              </div>
            ) : hasNoModels ? (
              <div className="text-description-muted px-2 py-4 text-center text-sm">
                No models configured
              </div>
            ) : (
              sortedOptions.map((option, idx) => (
                <ModelOption
                  option={option}
                  idx={idx}
                  key={idx}
                  showMissingApiKeyMsg={option.apiKey === ""}
                  isSelected={option.value === selectedModel?.title}
                />
              ))
            )}
          </div>

          {!isConfigLoading && selectedProfile?.profileType === "local" && (
            <ListboxOption
              key={options.length}
              onClick={onClickAddModel}
              value={"addModel" as any}
              className="border-border border-x-0 border-y border-solid"
            >
              <div
                className="text-description flex items-center py-0.5 hover:text-inherit"
                style={{
                  fontSize: fontSize(-3),
                }}
              >
                <PlusIcon className="mr-2 h-3 w-3" />
                Add Chat model
              </div>
            </ListboxOption>
          )}

          {!isConfigLoading && (
            <div
              className="text-description-muted px-2 py-1"
              style={{ fontSize: fontSize(-3) }}
            >
              <code>{getMetaKeyLabel()}'</code> to toggle model
            </div>
          )}
        </ListboxOptions>
      </div>
      {/* Confirm dialog when user picks "openai" or "gpt" */}
      {showPopup && (
        <OcaRestrictivePopup
          onAcknowledge={handleConfirm}
          bannerText={`<div class="m-auto max-w-full w-[56rem] mx-2 shadow-3xl min-h-fit scrollbar-hidden bg-white dark:bg-gray-900 rounded-2xl svelte-fq1rhy"
     style="">
    <div class="px-5 pt-4 dark:text-gray-300 text-gray-700">
        <div class="flex justify-between items-start">
            <div class="text-xl font-semibold">Acknowledgement required to access Oracle Code Assist</div>
        </div>
    </div>
    <div class="w-full p-4 px-5 text-gray-700 dark:text-gray-100">
        <div class="overflow-y-scroll max-h-150 scrollbar-hidden">
            <div class="mb-3 pr-2 my-2.5 px-1.5">
                <div class="text-sm mb-2">
                    <div class="mb-2 mt-1 text-sm/6 leading-6"><h3 class="text-lg/6 font-semibold text-gray-900">
                        Disclaimer: Prohibited Data Submission</h3>
                        <p class="mt-4 text-base/6 leading-6 text-gray-900 font-semibold">Attention Employees:</p>
                        <p>By using this system, you acknowledge and agree that:</p>
                        <p class="mt-2">You are not located in or accessing this system from China, Guam, Hong Kong,
                            Macao, Puerto Rico or Ukraine; and</p>
                        <p class="mt-2">You are strictly <strong>prohibited</strong> from uploading, submitting, or
                            sharing the following types of data or submitting prompts requesting information about the
                            following types of data through this platform, tool, or service:</p>
                        <ul class="list-disc list-outside my-4 ml-8">
                            <li>Non-public Oracle or line of business quarterly or annual financial results</li>
                            <li>Any non-public information regarding vulnerabilities in any Oracle software or service
                            </li>
                            <li>Oracle Database source code</li>
                            <li>Oracle policies</li>
                            <li>Oracle employee PII or other HR data of any kind</li>
                            <li>Health data of any kind, including but not limited to Protected Health Information
                                (PHI)
                            </li>
                            <li>Any customer credit card or bank account details, or Payment Card Industry (PCI) data
                            </li>
                            <li>Data related to any Oracle M&amp;A activity</li>
                            <li>Data pertaining to any pending, active or potential litigation or dispute</li>
                            <li>Data with special handling restrictions imposed by law or contract, including data
                                residency and nonstandard disclosure constraints
                            </li>
                            <li>Any usernames, passwords, authentication tokens or other access credentials for any
                                Oracle or third-party system
                            </li>
                        </ul>
                        <p class="text-base/6 leading-6 text-gray-900 font-semibold">Violation of this policy may result
                            in disciplinary action, up to and including termination of employment, and/or legal
                            consequences.
                            This policy does not supersede any other relevant Oracle policy.</p>
                        <p class="mt-2">If you are unsure whether your data falls under these categories, please consult
                            your manager or the Information Security team <strong>before</strong> submission.</p></div>
                </div>
            </div>
        </div>
    </div>
</div>`}
        />
      )}
    </Listbox>
  );
}

export default ModelSelect;
