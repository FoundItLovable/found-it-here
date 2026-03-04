import { useEffect, useState } from 'react';
import { MapPin, Building2 } from 'lucide-react';
import { FadeInSection } from '@/components/FadeInSection';
import { supabase } from '../../lib/supabase';

interface Office {
  office_id: string;
  office_name: string | null;
  building_name: string | null;
  office_address: string | null;
}

export function OfficeLocationsMap() {
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOffices = async () => {
      try {
        const { data } = await supabase
          .from('offices')
          .select('office_id, office_name, building_name, office_address')
          .order('office_name');
        setOffices(data ?? []);
      } catch {
        setOffices([]);
      } finally {
        setLoading(false);
      }
    };
    void fetchOffices();
  }, []);

  if (loading || offices.length === 0) return null;

  return (
    <FadeInSection>
      <section className="py-20 md:py-32 bg-card/30 border-y border-border/50">
        <div className="container mx-auto px-4 space-y-10">
          <div className="max-w-2xl mx-auto text-center space-y-2">
            <h2 className="font-display text-3xl md:text-4xl font-bold">Lost & Found Locations</h2>
            <p className="text-muted-foreground">
              Find your nearest lost & found office
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {offices.map((office) => (
              <div
                key={office.office_id}
                className="group p-5 rounded-xl border border-border/50 bg-card hover:border-primary/40 hover:shadow-lg transition-all duration-200 ease-out flex gap-4"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-foreground truncate">
                    {office.office_name || 'Lost & Found Office'}
                  </h3>
                  {office.building_name && (
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Building2 className="w-3.5 h-3.5 flex-shrink-0" />
                      {office.building_name}
                    </p>
                  )}
                  {office.office_address && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {office.office_address}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  );
}
