
-- 1. Order types enum and tasks extension
CREATE TYPE public.order_type AS ENUM ('service', 'rent', 'ride', 'cargo');
CREATE TYPE public.order_status AS ENUM ('pending', 'paid', 'in_progress', 'completed', 'cancelled');

ALTER TABLE public.tasks
  ADD COLUMN order_type public.order_type NOT NULL DEFAULT 'service',
  ADD COLUMN meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN order_status public.order_status NOT NULL DEFAULT 'pending';

-- 2. listings
CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  description text,
  address text,
  price_per_night numeric,
  photos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Listings viewable by everyone" ON public.listings FOR SELECT USING (true);
CREATE POLICY "Owners can insert listings" ON public.listings FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update listings" ON public.listings FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete listings" ON public.listings FOR DELETE USING (auth.uid() = owner_id);
CREATE TRIGGER trg_listings_updated_at BEFORE UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. availabilities
CREATE TABLE public.availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  date date NOT NULL,
  is_booked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (listing_id, date)
);
ALTER TABLE public.availabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Availabilities viewable by everyone" ON public.availabilities FOR SELECT USING (true);
CREATE POLICY "Listing owner manages availabilities"
  ON public.availabilities FOR ALL
  USING (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = availabilities.listing_id AND l.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.listings l WHERE l.id = availabilities.listing_id AND l.owner_id = auth.uid()));

-- 4. rides
CREATE TABLE public.rides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL,
  route jsonb NOT NULL DEFAULT '{}'::jsonb,
  departure_time timestamptz NOT NULL,
  seats_total int NOT NULL,
  seats_available int NOT NULL,
  price numeric,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Rides viewable by everyone" ON public.rides FOR SELECT USING (true);
CREATE POLICY "Driver can insert rides" ON public.rides FOR INSERT WITH CHECK (auth.uid() = driver_id);
CREATE POLICY "Driver can update rides" ON public.rides FOR UPDATE USING (auth.uid() = driver_id);
CREATE POLICY "Driver can delete rides" ON public.rides FOR DELETE USING (auth.uid() = driver_id);
CREATE TRIGGER trg_rides_updated_at BEFORE UPDATE ON public.rides FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. ride_bookings
CREATE TABLE public.ride_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_id uuid NOT NULL REFERENCES public.rides(id) ON DELETE CASCADE,
  passenger_id uuid NOT NULL,
  seats int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ride_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Passenger or driver views booking"
  ON public.ride_bookings FOR SELECT
  USING (
    auth.uid() = passenger_id
    OR EXISTS (SELECT 1 FROM public.rides r WHERE r.id = ride_bookings.ride_id AND r.driver_id = auth.uid())
  );
CREATE POLICY "Passenger can create booking" ON public.ride_bookings FOR INSERT WITH CHECK (auth.uid() = passenger_id);
CREATE POLICY "Passenger can delete own booking" ON public.ride_bookings FOR DELETE USING (auth.uid() = passenger_id);

-- 6. wallets
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "User views own wallet" ON public.wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User inserts own wallet" ON public.wallets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "User updates own wallet" ON public.wallets FOR UPDATE USING (auth.uid() = user_id);
CREATE TRIGGER trg_wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
