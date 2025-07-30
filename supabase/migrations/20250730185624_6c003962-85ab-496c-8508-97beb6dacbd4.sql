-- Vytvoření tabulky pro denní záznamy výdělků
CREATE TABLE public.daily_earnings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'denis',
  date DATE NOT NULL,
  morning_cash INTEGER NOT NULL,
  evening_cash INTEGER NOT NULL,
  total_orders INTEGER NOT NULL,
  cash_orders INTEGER NOT NULL,
  cash_earnings INTEGER NOT NULL DEFAULT 0,
  online_earnings INTEGER NOT NULL DEFAULT 0,
  bonus_earnings INTEGER NOT NULL DEFAULT 0,
  total_earnings INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Povolit RLS
ALTER TABLE public.daily_earnings ENABLE ROW LEVEL SECURITY;

-- Vytvořit politiky pro přístup
CREATE POLICY "Users can view their own earnings" 
ON public.daily_earnings 
FOR SELECT 
USING (user_id = 'denis');

CREATE POLICY "Users can create their own earnings" 
ON public.daily_earnings 
FOR INSERT 
WITH CHECK (user_id = 'denis');

CREATE POLICY "Users can update their own earnings" 
ON public.daily_earnings 
FOR UPDATE 
USING (user_id = 'denis');

CREATE POLICY "Users can delete their own earnings" 
ON public.daily_earnings 
FOR DELETE 
USING (user_id = 'denis');

-- Funkce pro automatické aktualizování updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger pro automatické aktualizování časového razítka
CREATE TRIGGER update_daily_earnings_updated_at
BEFORE UPDATE ON public.daily_earnings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Funkce pro výpočet výdělků
CREATE OR REPLACE FUNCTION public.calculate_earnings(
  total_orders INTEGER,
  cash_orders INTEGER,
  morning_cash INTEGER,
  evening_cash INTEGER
) RETURNS TABLE (
  cash_earnings INTEGER,
  online_earnings INTEGER,
  bonus_earnings INTEGER,
  total_earnings INTEGER
) AS $$
DECLARE
  expected_cash INTEGER;
  actual_cash_diff INTEGER;
  calc_cash_earnings INTEGER;
  calc_online_earnings INTEGER;
  calc_bonus_earnings INTEGER;
  calc_total_earnings INTEGER;
BEGIN
  -- Výpočet očekávaných hotovostních příjmů
  expected_cash := CASE 
    WHEN cash_orders <= 30 THEN cash_orders * 55
    ELSE (30 * 55) + ((cash_orders - 30) * 75)
  END;
  
  -- Skutečný rozdíl v hotovosti
  actual_cash_diff := evening_cash - morning_cash;
  
  -- Hotovostní výdělky = skutečný rozdíl + očekávané příjmy z hotovostních objednávek
  calc_cash_earnings := actual_cash_diff + expected_cash;
  
  -- Online výdělky
  calc_online_earnings := CASE 
    WHEN (total_orders - cash_orders) <= 30 THEN (total_orders - cash_orders) * 55
    ELSE (30 * 55) + (((total_orders - cash_orders) - 30) * 75)
  END;
  
  -- Bonus výdělky (20 CZK za každou objednávku nad 30)
  calc_bonus_earnings := CASE 
    WHEN total_orders > 30 THEN (total_orders - 30) * 20
    ELSE 0
  END;
  
  -- Celkové výdělky
  calc_total_earnings := calc_cash_earnings + calc_online_earnings + calc_bonus_earnings;
  
  RETURN QUERY SELECT 
    calc_cash_earnings,
    calc_online_earnings,
    calc_bonus_earnings,
    calc_total_earnings;
END;
$$ LANGUAGE plpgsql;