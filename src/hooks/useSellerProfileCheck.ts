import { useState, useCallback } from "react";

const STORE_API = "https://functions.poehali.dev/3e3f9722-84e4-4350-ae87-8b70b639746c";

export interface SellerProfileIssue {
  field: string;
  label: string;
}

export interface SellerProfileCheckResult {
  ok: boolean;
  issues: SellerProfileIssue[];
  profileExists: boolean;
  legalType?: string;
}

export function useSellerProfileCheck(userId: string | undefined, profileType: "individual" | "legal" = "individual") {
  const [checking, setChecking] = useState(false);

  const check = useCallback(async (): Promise<SellerProfileCheckResult> => {
    if (!userId) return { ok: false, issues: [{ field: "profile", label: "Не авторизован" }], profileExists: false };

    setChecking(true);
    try {
      const r = await fetch(`${STORE_API}?action=get_seller_profile&user_id=${userId}&profile_type=${profileType}`);
      const data = await r.json();

      if (!data || !data.legalType) {
        return { ok: false, issues: [{ field: "profile", label: "Профиль продавца не заполнен" }], profileExists: false };
      }

      const issues: SellerProfileIssue[] = [];
      const lt = data.legalType as string;

      if (!data.legalName?.trim()) issues.push({ field: "legalName", label: "ФИО или название организации" });
      if (lt !== "individual" && !data.inn?.trim()) issues.push({ field: "inn", label: "ИНН" });

      if (lt === "self_employed") {
        if (!data.phoneForTax?.trim()) issues.push({ field: "phoneForTax", label: "Телефон в «Мой налог»" });
        if (data.payoutMethod === "card" || !data.payoutMethod) {
          if (!data.cardNumber?.trim()) issues.push({ field: "cardNumber", label: "Номер карты для выплат" });
        } else {
          if (!data.bankAccount?.trim()) issues.push({ field: "bankAccount", label: "Расчётный счёт" });
          if (!data.bik?.trim()) issues.push({ field: "bik", label: "БИК банка" });
        }
      } else if (lt === "individual") {
        if (!data.cardNumber?.trim()) issues.push({ field: "cardNumber", label: "Номер карты для выплат" });
      } else if (lt === "ip" || lt === "ooo") {
        if (!data.bankAccount?.trim()) issues.push({ field: "bankAccount", label: "Расчётный счёт" });
        if (!data.bik?.trim()) issues.push({ field: "bik", label: "БИК банка" });
      }

      if (!data.agreedOffer) issues.push({ field: "agreedOffer", label: "Согласие с договором оферты" });
      if (!data.agreedPd) issues.push({ field: "agreedPd", label: "Согласие на обработку персональных данных" });

      return { ok: issues.length === 0, issues, profileExists: true, legalType: lt };
    } catch {
      return { ok: false, issues: [{ field: "network", label: "Ошибка соединения" }], profileExists: false };
    } finally {
      setChecking(false);
    }
  }, [userId, profileType]);

  return { check, checking };
}