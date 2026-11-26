"use client";

// 檔期的計價資訊，新增專案、編輯專案、編輯／追加檔期四個表單共用；必須放在 <Form>（FormProvider）裡。
// 版面順序照填寫順序排：
//   <RentalPricingFields>  方案、折扣、國定假日 → 標準價（自動算）與「帶入」按鈕   ← 放在金額列上方
//   （各表單自己的金額列：場租、餐飲、已付、待付）
//   <RentalPriceNoteField> 議價理由                                                ← 放在金額列下方

import { useFormContext, useWatch } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { getSpaceNameById } from "@/lib/config/config";
import { PRICE_PLANS, applyDiscount, rentalStandardPrice } from "@/lib/quote/standard-price";

const money = (n: number) => `NT$ ${n.toLocaleString("en-US")}`;

interface Props {
  /** 欄位名稱前綴：專案表單傳 `rentals.${index}.`，單筆檔期的對話框不用傳 */
  prefix?: string;
  /** 單筆檔期對話框沒有折扣欄位，由專案資料傳入；專案表單不傳，直接讀表單上的折扣 */
  discountPercent?: number | null;
  /** 專案表單有多筆檔期時，折扣輸入框只放在第一筆，其餘傳 true 顯示「同第 1 筆」 */
  discountSameAsFirst?: boolean;
}

/** 讀表單上這筆檔期的值，算出標準價、折後應收、目前填的場地費 */
function useRentalPricing({ prefix = "", discountPercent }: Props) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- 四個表單的型別不同，欄位名稱以字串組合
  const { control, setValue } = useFormContext<any>();
  const rental = useWatch({ control, name: prefix ? prefix.slice(0, -1) : undefined } as never) as Record<string, unknown> | undefined;
  const formDiscount = useWatch({ control, name: "discountPercent" }) as string | undefined;
  const discount = discountPercent !== undefined ? discountPercent : Number(formDiscount) || null;
  const std = rental
    ? rentalStandardPrice({
        spaceIds: (rental.spaceIds as string[]) ?? [],
        date: String(rental.date ?? ""),
        endDate: String(rental.endDate ?? ""),
        startTime: String(rental.startTime ?? ""),
        endTime: String(rental.endTime ?? ""),
        pricePlan: String(rental.pricePlan ?? "A"),
        isHoliday: rental.isHoliday === true,
      })
    : null;
  return {
    control,
    setValue,
    discount,
    std,
    expected: std ? applyDiscount(std.amount, discount) : 0,
    current: Number(rental?.rentalAmount) || 0,
  };
}

export function RentalPricingFields(props: Props) {
  const { prefix = "", discountSameAsFirst } = props;
  const { control, setValue, discount, std, expected, current } = useRentalPricing(props);

  return (
    <div className="space-y-3 rounded-md border border-dashed p-3">
      <div className={prefix ? "grid gap-4 sm:grid-cols-3" : "grid gap-4 sm:grid-cols-2"}>
        <FormField
          control={control}
          name={`${prefix}pricePlan`}
          render={({ field }) => (
            <FormItem>
              <FormLabel>計價方案（教室／展演廳）</FormLabel>
              <FormControl>
                <select
                  {...field}
                  value={field.value ?? "A"}
                  className="border-input h-9 w-full rounded-md border bg-transparent px-3 text-sm shadow-xs"
                >
                  {PRICE_PLANS.map((p) => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        {/* 折扣是整個專案一個值：專案表單裡每個檔期的框都綁同一個欄位；單筆檔期對話框只顯示、不能改 */}
        {prefix && discountSameAsFirst ? (
          <FormItem>
            <FormLabel>長期合作折扣</FormLabel>
            <div className="bg-muted/50 text-muted-foreground flex h-9 items-center rounded-md border px-3 text-sm">
              同第 1 筆{discount ? `（${discount} 折）` : "（無）"}
            </div>
          </FormItem>
        ) : prefix ? (
          <FormField
            control={control}
            name="discountPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>長期合作折扣</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} inputMode="numeric" placeholder="例：85＝85 折，沒有請留空" className="tabular-nums" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        ) : null}
        <FormField
          control={control}
          name={`${prefix}isHoliday`}
          render={({ field }) => (
            <FormItem className="flex flex-row items-center gap-2 sm:pt-7">
              <FormControl>
                <Checkbox checked={field.value === true} onCheckedChange={(v) => field.onChange(v === true)} />
              </FormControl>
              <FormLabel className="font-normal">國定假日（以假日價計）</FormLabel>
            </FormItem>
          )}
        />
      </div>

      <div className="text-sm" aria-live="polite">
        {!std ? (
          <p className="text-muted-foreground">選好場域、日期與時間後，這裡會顯示標準價</p>
        ) : (
          <>
            <p>
              <span className="font-medium tabular-nums">標準價 {money(std.amount)}</span>
              {discount ? <span className="tabular-nums">　長期合作 {discount} 折後 {money(expected)}</span> : null}
              {expected > 0 && current !== expected ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="ml-2 h-7"
                  onClick={() => setValue(`${prefix}rentalAmount`, expected, { shouldDirty: true, shouldValidate: true })}
                >
                  {discount ? "帶入折後場地費" : "帶入標準場地費"}
                </Button>
              ) : null}
              {expected > 0 && current === expected ? (
                <span className="text-muted-foreground ml-2 text-xs">已與下方場租金額一致</span>
              ) : null}
            </p>
            {std.details.map((d) => (
              <p key={d} className="text-muted-foreground text-xs">{d}</p>
            ))}
            {!prefix ? (
              <p className="text-muted-foreground text-xs">
                長期合作折扣：{discount ? `${discount} 折` : "無"}（在「編輯專案」修改）
              </p>
            ) : null}
            {std.noPrice.length ? (
              <p className="text-muted-foreground text-xs">
                {std.noPrice.map(getSpaceNameById).join("、")}沒有標準價，請自行加進場租金額
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** 議價理由：放在金額列下方。場租金額與標準價（或折後價）不同又沒填時提醒，不擋存檔 */
export function RentalPriceNoteField(props: Props) {
  const { prefix = "" } = props;
  const { control, discount, expected, current } = useRentalPricing(props);

  return (
    <FormField
      control={control}
      name={`${prefix}priceNote`}
      render={({ field }) => (
        <FormItem>
          <FormLabel>議價理由（場租金額與標準價不同時填，只有內部看得到）</FormLabel>
          {expected > 0 && current > 0 && current !== expected && !String(field.value ?? "").trim() ? (
            <p className="text-xs text-amber-700">
              場租金額 {money(current)} 與{discount ? "折後" : "標準"}價 {money(expected)} 不同，建議寫下理由方便日後查詢
            </p>
          ) : null}
          <FormControl>
            <Input {...field} value={field.value ?? ""} placeholder="例：長期合作夥伴、平日離峰優惠" />
          </FormControl>
          <FormMessage />
          <p className="text-muted-foreground text-xs">
            餐飲金額不會自動跟報價單同步；在報價單按「儲存到專案」時會詢問要不要寫入。
          </p>
        </FormItem>
      )}
    />
  );
}
