import React from 'react';
import { View } from 'react-native';

const MapView = (props) => {
  const r = props.region || props.initialRegion;
  const lat = r?.latitude || 33.6844;
  const lng = r?.longitude || 73.0479;
  const zoom = r?.latitudeDelta < 0.005 ? 19 : 14;
  
  let searchQuery = `${lat},${lng}`;
  if (props.children) {
    const childrenArray = React.Children.toArray(props.children);
    const providerMarker = childrenArray.find(child => {
      if (child && child.props && child.props.title) {
        const titleLower = child.props.title.toLowerCase();
        return !titleLower.includes("your location") && !titleLower.includes("pinned location");
      }
      return false;
    });
    if (providerMarker) {
      const title = providerMarker.props.title;
      const desc = providerMarker.props.description || '';
      searchQuery = `${title}, ${desc}`;
    }
  }

  let embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(searchQuery)}&t=&z=${zoom}&ie=UTF8&iwloc=near&output=embed`;
  
  if (props.sourceLat && props.sourceLng && props.destLat && props.destLng) {
    embedUrl = `https://maps.google.com/maps?saddr=${props.sourceLat},${props.sourceLng}&daddr=${props.destLat},${props.destLng}&t=&ie=UTF8&iwloc=near&output=embed`;
  }
  
  return (
    <View style={[{ backgroundColor: '#1A1A1A', overflow: 'hidden' }, props.style]}>
      <iframe
        src={embedUrl}
        style={{ width: '100%', height: '100%', border: 'none' }}
        allowFullScreen
        loading="lazy"
      />
    </View>
  );
};

const Marker = () => null;

export { MapView, Marker };
