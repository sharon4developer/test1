import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import type { PlaceResult, RouteOption } from '../native/ParkCastNative';
import { regionForPoints, toLatLngs, type LatLng } from '../lib/places';
import { colors } from '../ui/theme';

export interface NavMapHandle {
  recenter: () => void;
}

export interface NavMapProps {
  userLocation: LatLng | null;
  places: PlaceResult[];
  destination: PlaceResult | null;
  routes: RouteOption[];
  selectedRoute: number;
  following: boolean;
  bottomInset: number;
  topInset: number;
  onSelectPlace: (place: PlaceResult) => void;
  onSelectRoute: (index: number) => void;
}

const FALLBACK_REGION = { latitude: 37.3349, longitude: -122.009, latitudeDelta: 40, longitudeDelta: 40 };

export const NavMap = forwardRef<NavMapHandle, NavMapProps>(function NavMap(
  { userLocation, places, destination, routes, selectedRoute, following, bottomInset, topInset, onSelectPlace, onSelectRoute },
  ref
) {
  const map = useRef<MapView>(null);
  const lines = useMemo(() => routes.map((route) => toLatLngs(route.coordinates)), [routes]);

  const padding = { top: topInset + 40, right: 40, bottom: bottomInset + 30, left: 40 };

  const fit = (points: LatLng[]) => {
    if (!map.current || !points.length) return;
    if (points.length === 1) {
      const region = regionForPoints(points, 1, 0.02);
      if (region) map.current.animateToRegion(region, 450);
      return;
    }
    map.current.fitToCoordinates(points, { edgePadding: padding, animated: true });
  };

  const live = useRef<LatLng | null>(null);

  const recenter = () => {
    const center = live.current ?? userLocation;
    if (!center || !map.current) return;
    map.current.animateCamera({ center, zoom: following ? 17 : 15, heading: 0, pitch: following ? 45 : 0 }, { duration: 450 });
  };

  useImperativeHandle(ref, () => ({ recenter }));

  useEffect(() => {
    if (following) return;
    if (lines.some((line) => line.length)) {
      fit(lines.flat());
    } else if (destination) {
      fit([destination, ...(userLocation ? [userLocation] : [])]);
    } else if (places.length) {
      fit([...places, ...(userLocation ? [userLocation] : [])]);
    }
    // Refit only when what is shown changes, not on every GPS tick.
  }, [lines, destination, places, following, bottomInset]);

  const centeredOnce = useRef(false);
  useEffect(() => {
    if (userLocation && !centeredOnce.current && !places.length && !destination) {
      centeredOnce.current = true;
      map.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 1);
    }
  }, [userLocation, places.length, destination]);

  useEffect(() => {
    if (following) recenter();
  }, [following]);

  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={userLocation ? { ...userLocation, latitudeDelta: 0.03, longitudeDelta: 0.03 } : FALLBACK_REGION}
      showsUserLocation
      onUserLocationChange={(event) => {
        const coordinate = event.nativeEvent.coordinate;
        if (!coordinate) return;
        const first = live.current == null;
        live.current = { latitude: coordinate.latitude, longitude: coordinate.longitude };
        if (first && !centeredOnce.current && !places.length && !destination) {
          centeredOnce.current = true;
          map.current?.animateToRegion({ ...live.current, latitudeDelta: 0.03, longitudeDelta: 0.03 }, 1);
        }
      }}
      followsUserLocation={following}
      showsCompass={false}
      showsPointsOfInterests
      showsTraffic={routes.length > 0 || following}
      pitchEnabled
      mapPadding={{ top: topInset, right: 0, bottom: bottomInset, left: 0 }}
    >
      {lines.map((line, index) =>
        index === selectedRoute || !line.length ? null : (
          <Polyline
            key={`alt-${index}`}
            coordinates={line}
            strokeColor="#9BB8E8"
            strokeWidth={7}
            tappable
            onPress={() => onSelectRoute(index)}
          />
        )
      )}
      {lines[selectedRoute]?.length ? (
        <Polyline key={`sel-${selectedRoute}`} coordinates={lines[selectedRoute]} strokeColor={colors.primary} strokeWidth={8} zIndex={2} />
      ) : null}
      {destination ? (
        <Marker coordinate={destination} title={destination.name} description={destination.address} pinColor={colors.danger} />
      ) : (
        places.map((place) => (
          <Marker
            key={place.id}
            coordinate={place}
            title={place.name}
            description={place.address}
            pinColor={colors.primary}
            onCalloutPress={() => onSelectPlace(place)}
            onPress={() => onSelectPlace(place)}
          />
        ))
      )}
    </MapView>
  );
});
