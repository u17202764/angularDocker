import { Injectable } from '@angular/core';
import { Client, Message, StompSubscription } from '@stomp/stompjs';
import  SockJS from 'sockjs-client';
import {BehaviorSubject, Observable, Subject} from 'rxjs';
import { filter, first, switchMap } from 'rxjs/operators';
import {HttpHeaders} from "@angular/common/http";

@Injectable({
  providedIn: 'root'
})
export class WebsocketService {
  private client!: Client;
  private connectionStatus$ = new BehaviorSubject<boolean>(false);
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private messageSubject: Subject<any> = new Subject<any>();
  constructor() {
    this.initializeWebSocketConnection();
  }

  private initializeWebSocketConnection(): void {


    // Configuración de la conexión WebSocket
    this.client = new Client({
      webSocketFactory: () => new SockJS('https://docker-java-lmse.onrender.com/ws-register/ws-register'),
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      debug: (str) => console.log(str), // Opcional: para depuración
    });

    // Configurar callbacks
    this.client.onConnect = (frame) => {
      console.log('Conectado al WebSocket: ' + frame);
      this.connectionStatus$.next(true);

      this.reconnectAttempts = 0;

      // Aquí te suscribes y rediriges los mensajes al Subject
      this.client.subscribe('/topic/registrations', (message: Message) => {
        try {
          const data = JSON.parse(message.body);
          console.log('Parsed data:', data);
          this.messageSubject.next(data);
        } catch (error) {
          console.error('Error parsing message JSON:', error);
        }
      });


    };




    this.client.onStompError = (frame) => {
      console.error('Error en STOMP: ' + frame.headers['message']);
    };

    this.client.onWebSocketError = (event) => {
      console.error('Error en WebSocket:', event);
      this.attemptReconnect();
    };

    this.client.onWebSocketClose = (event) => {
      console.log('Conexión WebSocket cerrada:', event);
      this.connectionStatus$.next(false);
      this.attemptReconnect();
    };

    // Activar la conexión
    this.client.activate();
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Intentando reconectar (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      setTimeout(() => this.client.activate(), 5000);
    } else {
      console.error('Número máximo de intentos de reconexión alcanzado');
    }
  }

  // Método para suscribirse a un tema
  subscribe(topic: string, callback: (message: Message) => void): StompSubscription {
    return this.client.subscribe(topic, callback);
  }

  // Método para enviar mensajes
  send(destination: string, body: any, headers: any = {}): void {
    this.waitForConnection().subscribe(() => {
      this.client.publish({
        destination,
        body: JSON.stringify(body),
        headers
      });
    });
  }

  // Método para esperar hasta que la conexión esté establecida
  private waitForConnection(): Observable<void> {
    return this.connectionStatus$.pipe(
      filter(connected => connected),
      first(),
      switchMap(() => new Observable<void>(observer => {
        observer.next();
        observer.complete();
      }))
    );
  }

  // Método para desconectar
  disconnect(): void {
    if (this.client && this.client.active) {
      this.client.deactivate().then(() => {
        console.log('Desconectado del WebSocket');
      });
    }
  }

  // Verificar estado de conexión
  isConnected(): Observable<boolean> {
    return this.connectionStatus$.asObservable();
  }
}
