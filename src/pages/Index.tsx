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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Legend } from "recharts";
import { toast } from "@/components/ui/sonner";
import { LogOut, Trash2 } from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"

// Validation schema for the form
const formSchema = z.object({
  morning_cash: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  evening_cash: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  total_orders: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  cash_orders: z.coerce.number().int().min(0, "Hodnota nesmí být záporná."),
  online_tips: z.coerce.number().int().min(0, "Hodnota nesmí být záporná.").default(0),
}).refine(data => data.cash_orders <= data.total_orders, {
  message: "Hotovostní objednávky nemohou být vyšší než celkový počet.",
  path: ["cash_orders"],
});

type Earnings = {
  id: string;
  date: string;
  morning_cash: number;
  evening_cash: number;
  total_orders: number;
  cash_orders: number;
  total_earnings: number;
  cash_earnings: number;
  online_tips: number;
  online_earnings: number;
  bonus_earnings: number;
};

type Summary = {
    total_online_earnings: number;
    total_bonus_earnings: number;
    total_cash_earnings: number;
    total_online_tips: number;
    grand_total_earnings: number;
}

const fetchEarnings = async () => {
  const { data, error } = await supabase
    .from("daily_earnings")
    .select("*")
    .order("date", { ascending: false });
  if (error) throw new Error(error.message);
  return data;
};

const fetchSummary = async (userId: string) => {
    const { data, error } = await supabase.rpc('get_earnings_summary', { p_user_id: userId });
    if (error) throw new Error(error.message);
    return data[0];
}

const Dashboard = ({ session }: { session: Session }) => {
  const queryClient = useQueryClient();

  const { data: earnings = [], isLoading: isLoadingEarnings } = useQuery<Earnings[]>({
    queryKey: ["earnings"],
    queryFn: fetchEarnings,
  });

  const { data: summary, isLoading: isLoadingSummary } = useQuery<Summary>({
      queryKey: ["summary", session.user.id],
      queryFn: () => fetchSummary(session.user.id),
  })

  const insertMutation = useMutation({
    mutationFn: async (newEarning: z.infer<typeof formSchema>) => {
      const { error } = await supabase.from("daily_earnings").insert([
        {
          ...newEarning,
          date: format(new Date(), "yyyy-MM-dd"),
          user_id: session.user.id,
        },
      ]);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["earnings"] });
      queryClient.invalidateQueries({ queryKey: ["summary"] });
      toast.success("Záznam byl úspěšně uložen!");
      form.reset();
    },
    onError: (error) => {
      toast.error(`Chyba při ukládání: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
          const { error } = await supabase.from("daily_earnings").delete().eq('id', id);
          if (error) throw new Error(error.message);
      },
      onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["earnings"] });
          queryClient.invalidateQueries({ queryKey: ["summary"] });
          toast.success("Záznam byl smazán.");
      },
      onError: (error) => {
          toast.error(`Chyba při mazání: ${error.message}`);
      }
  })

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      morning_cash: 0,
      evening_cash: 0,
      total_orders: 0,
      cash_orders: 0,
      online_tips: 0,
    },
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    insertMutation.mutate(values);
  }
  
  const handleDelete = (id: string) => {
      deleteMutation.mutate(id);
  }

  const chartData = earnings
    .filter(e => new Date(e.date) >= subDays(new Date(), 7))
    .map(e => ({
      date: format(new Date(e.date), "d. M.", { locale: cs }),
      "Celkem Kč": e.total_earnings,
      "Dýška celkem Kč": e.cash_earnings + e.online_tips,
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
              <CardTitle>Nový záznam ({format(new Date(), "d. MMMM", { locale: cs })})</CardTitle>
              <CardDescription>Zadej údaje ze své poslední směny.</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField control={form.control} name="morning_cash" render={({ field }) => (
                    <FormItem><FormLabel>Hotovost ráno (Kč)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="evening_cash" render={({ field }) => (
                    <FormItem><FormLabel>Hotovost večer (Kč)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                   <FormField control={form.control} name="total_orders" render={({ field }) => (
                    <FormItem><FormLabel>Celkem objednávek</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="cash_orders" render={({ field }) => (
                    <FormItem><FormLabel>Z toho hotovostních</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="online_tips" render={({ field }) => (
                    <FormItem><FormLabel>Dýška online (Kč)</FormLabel><FormControl><Input type="number" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <Button type="submit" className="w-full" disabled={insertMutation.isPending}>
                    {insertMutation.isPending ? "Ukládám..." : "Uložit záznam"}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
          <Card>
            <CardHeader><CardTitle>Týdenní přehled</CardTitle><CardDescription>Vývoj tvých výdělků za posledních 7 dní.</CardDescription></CardHeader>
            <CardContent>
              <ChartContainer config={{}} className="h-[250px] w-full">
                <BarChart data={chartData}>
                  <CartesianGrid vertical={false} />
                  <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Legend />
                  <Bar dataKey="Celkem Kč" fill="hsl(var(--primary))" radius={4} />
                  <Bar dataKey="Dýška celkem Kč" fill="hsl(var(--accent))" radius={4} />
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Historie záznamů</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead className="text-right">Obj.</TableHead>
                    <TableHead className="text-right">Platba za obj.</TableHead>
                    <TableHead className="text-right">Bonus</TableHead>
                    <TableHead className="text-right">Dýška hot.</TableHead>
                    <TableHead className="text-right">Dýška onl.</TableHead>
                    <TableHead className="text-right font-bold">Celkem</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingEarnings ? (
                     Array.from({ length: 5 }).map((_, i) => (
                        <TableRow key={i}><TableCell colSpan={8} className="h-12 text-center">Načítání...</TableCell></TableRow>
                     ))
                  ) : (
                    earnings.map((e) => (
                      <Collapsible asChild key={e.id}>
                        <>
                        <TableRow>
                          <CollapsibleTrigger asChild>
                              <TableCell className="cursor-pointer font-medium">{format(new Date(e.date), "d. M. yyyy", { locale: cs })}</TableCell>
                          </CollapsibleTrigger>
                           <CollapsibleTrigger asChild><TableCell className="text-right cursor-pointer">{e.total_orders}</TableCell></CollapsibleTrigger>
                           <CollapsibleTrigger asChild><TableCell className="text-right cursor-pointer">{e.online_earnings} Kč</TableCell></CollapsibleTrigger>
                           <CollapsibleTrigger asChild><TableCell className="text-right cursor-pointer">{e.bonus_earnings} Kč</TableCell></CollapsibleTrigger>
                           <CollapsibleTrigger asChild><TableCell className="text-right cursor-pointer">{e.cash_earnings} Kč</TableCell></CollapsibleTrigger>
                           <CollapsibleTrigger asChild><TableCell className="text-right cursor-pointer">{e.online_tips} Kč</TableCell></CollapsibleTrigger>
                           <CollapsibleTrigger asChild><TableCell className="text-right font-bold cursor-pointer">{e.total_earnings} Kč</TableCell></CollapsibleTrigger>
                           <TableCell>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Opravdu smazat?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        Tato akce nelze vrátit zpět. Záznam bude trvale odstraněn.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(e.id)}>Smazat</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                           </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                            <TableRow className="bg-muted/50">
                                <TableCell colSpan={8} className="p-4">
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                                        <p><strong>Ráno v peněžence:</strong> {e.morning_cash} Kč</p>
                                        <p><strong>Večer v peněžence:</strong> {e.evening_cash} Kč</p>
                                        <p><strong>Celkem objednávek:</strong> {e.total_orders}</p>
                                        <p><strong>Z toho hotovostních:</strong> {e.cash_orders}</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        </CollapsibleContent>
                        </>
                      </Collapsible>
                    ))
                  )}
                </TableBody>
                <TableFooter>
                    <TableRow className="bg-muted/80 hover:bg-muted/80">
                        <TableHead>Celkem</TableHead>
                        <TableHead></TableHead>
                        <TableHead className="text-right">{isLoadingSummary ? "..." : `${summary?.total_online_earnings || 0} Kč`}</TableHead>
                        <TableHead className="text-right">{isLoadingSummary ? "..." : `${summary?.total_bonus_earnings || 0} Kč`}</TableHead>
                        <TableHead className="text-right">{isLoadingSummary ? "..." : `${summary?.total_cash_earnings || 0} Kč`}</TableHead>
                        <TableHead className="text-right">{isLoadingSummary ? "..." : `${summary?.total_online_tips || 0} Kč`}</TableHead>
                        <TableHead className="text-right font-bold">{isLoadingSummary ? "..." : `${summary?.grand_total_earnings || 0} Kč`}</TableHead>
                        <TableHead></TableHead>
                    </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
