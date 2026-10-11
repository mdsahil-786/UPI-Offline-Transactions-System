package com.demo.upimesh.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Fan-out of simulation events to every browser connected to /api/events.
 *
 * Each event is a flat JSON object: {"type": "...", "ts": 123, ...fields}.
 * With nobody connected, publish() returns immediately, so the ingestion
 * pipeline pays nothing for this when the UI is closed.
 */
@Service
public class EventBus {

    private static final Logger log = LoggerFactory.getLogger(EventBus.class);

    private final List<SseEmitter> emitters = new CopyOnWriteArrayList<>();

    /** Build a field map, turning null values into "" (Map.of rejects nulls). */
    public static Map<String, Object> fields(Object... keyValues) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < keyValues.length; i += 2) {
            m.put(String.valueOf(keyValues[i]), keyValues[i + 1] == null ? "" : keyValues[i + 1]);
        }
        return m;
    }

    public SseEmitter subscribe() {
        SseEmitter emitter = new SseEmitter(0L); // 0 = never time out
        emitters.add(emitter);
        Runnable drop = () -> emitters.remove(emitter);
        emitter.onCompletion(drop);
        emitter.onTimeout(drop);
        emitter.onError(t -> drop.run());
        try {
            send(emitter, SseEmitter.event().comment("connected"));
        } catch (IOException e) {
            drop.run();
        }
        log.info("Event stream opened ({} subscriber(s))", emitters.size());
        return emitter;
    }

    public void publish(String type, Map<String, Object> fields) {
        if (emitters.isEmpty()) return;
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("ts", System.currentTimeMillis());
        event.putAll(fields);
        for (SseEmitter emitter : emitters) {
            try {
                send(emitter, SseEmitter.event().data(event, MediaType.APPLICATION_JSON));
            } catch (Exception e) {
                emitters.remove(emitter); // client went away
            }
        }
    }

    /** SseEmitter is not thread-safe, and /api/mesh/flush ingests in parallel. */
    private void send(SseEmitter emitter, SseEmitter.SseEventBuilder event) throws IOException {
        synchronized (emitter) {
            emitter.send(event);
        }
    }

    /** Keeps idle connections from being closed by proxies. */
    @Scheduled(fixedDelay = 15_000)
    public void heartbeat() {
        for (SseEmitter emitter : emitters) {
            try {
                send(emitter, SseEmitter.event().comment("ping"));
            } catch (Exception e) {
                emitters.remove(emitter);
            }
        }
    }
}