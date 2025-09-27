type ModalTypes = {
  type: "loss" | "profit";
  multiplier: string;
  amount: string;
};

export const Modal = ({ type, multiplier, amount }: ModalTypes) => {
  return (
    <div className="absolute inset-0 w-full h-full z-[999] flex flex-col items-center justify-center">
      <div className="bg-black/50 w-full h-full z-0 absolute" />
      <img
        className="absolute mx-auto w-[273px] h-[186px] z-10 backdrop-blur-lg"
        src={type === "loss" ? "/lossModal.png" : "/profitModal.png"}
        alt=""
      />
      <div className="flex flex-col items-center justify-center z-20 pt-12 gap-2">
        <h2 className="text-2xl font-bold font-ethnocentric text-center">
          {type === "loss" ? "LOSE" : "WIN"}
        </h2>
        {!amount && (
          <p className="text-sm font-audiowide text-center">
            {type === "loss" ? "You lost" : "You won"} {amount}{" "}
            {Number(multiplier).toFixed(3)}x
          </p>
        )}
      </div>
    </div>
  );
};
