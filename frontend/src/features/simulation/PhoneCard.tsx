import type { MeshDevice } from '../../api/types';
import { Badge } from '../../components/Badge';
import styles from './PhoneCard.module.css';

interface Props {
    device: MeshDevice;
    active: boolean; // true while a packet is flying towards this phone
}

export function PhoneCard({ device, active }: Props) {
    const cls = [styles.card, device.hasInternet ? styles.bridge : '', active ? styles.active : '']
        .filter(Boolean)
        .join(' ');

    return (
        <div className={cls}>
            <div className={styles.head}>
                <strong className="mono">{device.deviceId}</strong>
                <Badge tone={device.hasInternet ? 'online' : 'offline'}>
                    {device.hasInternet ? '4G' : 'offline'}
                </Badge>
            </div>
            <div className="muted">holding {device.packetCount} packet(s)</div>
            {device.packetIds.length > 0 && (
                <div className={styles.ids}>
                    {device.packetIds.map((id) => (
                        <span key={id} className={styles.id}>
              {id}
            </span>
                    ))}
                </div>
            )}
        </div>
    );
}