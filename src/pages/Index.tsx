import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, subDays } from "date-fns";
import { cs } from 'date-fns/locale';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, LogOut } from "lucide-react";
import type { Session } from "@supabase/supabase-js";

// Validation schema for the form
const formSchema = z.object({
  date: z.date({ required_error: "Datum je povinné." }),
  morning_cash: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  total_orders: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  cash_orders: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  evening_cash: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
}).refine(data => data.cash_orders <= data.total_orders, {
  message: "Hotovostní objednávky nemohou být vyšší než celkový počet.",
  path: ["cash_orders"],
});

type Earnings = {
  id: string;
  date: string;
  total_orders: number;
  total_earnings: number;
  cash_earnings: number; // Dýška
  online_earnings: number; // Platba za objednávky
  bonus_earnings: number;
};

const fetchEarnings = async () => {
  const { data, error } = await supabase
    .from("daily_earnings")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const Dashboard = ({ session }: { session: Session }) => {
  const queryClient = useQueryClient();
  const { data: earnings = [], isLoading } = useQuery<Earnings[]>({
    queryKey: ["earnings"],
    queryFn: fetchEarnings,
  });

  const mutation = useMutation({
    mutationFn: async (newEarning: z.infer<typeof formSchema>) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("User not found");

      const { error } = await supabase.from("daily_earnings").insert([
        {
          ...newEarning,
          date: format(newEarning.date, "yyyy-MM-dd"),
          user_id: user.id,
        },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      toast.success("Záznam byl úspěšně uložen!");
      form.reset({
        date: new Date(),
        morning_cash: 0,
        total_orders: 0,
        cash_orders: 0,
        evening_cash: 0,
      });
    },
    onError: (error) => {
      toast.error(`Chyba při ukládání: ${error.message}`);
    },
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: new Date(),
      morning_cash: 0,
      total_orders: 0,
      cash_orders: 0,
      evening_cash: 0,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    mutation.mutate(values);
  }

  const chartData = earnings
    .filter(e => new Date(e.date) >= subDays(new Date(), 7))
    .map(e => ({
      date: format(new Date(e.date), "d. M.", { locale: cs }),
      "Celkem Kč": e.total_earnings,
      "Dýška Kč": e.cash_earnings,
    }))
    .reverse();
    
  return (
    <div className="container mx-auto p-4 md:p-8">
      <header className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">Přehled výdělků</h1>
         <Button variant="ghost" onClick={() => supabase.auth.signOut()}>
            <LogOut className="mr-2 h-4 w-4" />
            Odhlásit se
          </Button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Nový denní záznam</CardTitle>
              <CardDescription>Zadej údaje ze své poslední směny.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>Datum</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant={"outline"}
                                className={cn(
                                  "w-full pl-3 text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP", { locale: cs })
                                ) : (
                                  <span>Vyber datum</span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                              initialFocus
                              locale={cs}
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={form.control} name="morning_cash" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hotovost ráno (Kč)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="evening_cash" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hotovost večer (Kč)</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                   <FormField control={form.control} name="total_orders" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Celkem objednávek</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="cash_orders" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Z toho hotovostních</FormLabel>
                      <FormControl><Input type="number" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Ukládám..." : "Uložit záznam"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader>
              <CardTitle>Týdenní přehled</CardTitle>
              <CardDescription>Vývoj tvých výdělků za posledních 7 dní.</CardDescription>
            </CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[250px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Celkem Kč" fill="hsl(var(--primary))" radius={4} />
                  <Bar dataKey="Dýška Kč" fill="hsl(var(--accent))" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Historie záznamů</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Objednávky</TableHead>
                    <TableHead className="text-right">Platba za obj.</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Dýška</TableHead>
                    <TableHead className="text-right font-bold">Celkem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                     Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={6} className="h-12 text-center">Načítání...</TableCell></TableRow>
                     ))
                  ) : (
                    earnings.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{format(new Date(e.date), "d. M. yyyy", { locale: cs })}</TableCell>
                        <TableCell className="text-right">{e.total_orders}</TableCell>
                        <TableCell className="text-right">{e.online_earnings} Kč</TableCell>
                        <TableCell className="text-right">{e.bonus_earnings} Kč</TableCell>
                        <TableCell className="text-right">{e.cash_earnings} Kč</TableCell>
                        <TableCell className="text-right font-bold">{e.total_earnings} Kč</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
