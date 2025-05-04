import { CommonModule } from "@angular/common";
import {
  Component,
  OnInit,
  signal
} from '@angular/core';
import { CategoryNewService } from '../../CategoryNewService';

@Component({
  selector: 'app-listado',
  standalone: true,
  imports: [CommonModule],  // <-- Asegúrate de importar CommonModule
  templateUrl: './listado.component.html',
  styleUrl: './listado.component.scss'
})
export class ListadoComponent implements OnInit {
  currentPage = signal<number>(1)
  pageSize = signal<number>(20)
  currentData = signal<any[]>([])
  totalPages = signal<number>(0)
  errorMessage = signal<string>('')

  constructor(public dataService: CategoryNewService) {}

  ngOnInit(): void {
    this.loadData()
  }

  loadData(): void {
    this.errorMessage.set('')

    this.dataService.loadAllData().subscribe({
      next: () => {
        this.setupPagination()
        this.loadPageData()
      },
      error: (err) => {
        this.errorMessage.set('Error al cargar los datos. Por favor intente nuevamente.')
        console.error('Error loading data:', err)
      }
    })
  }

  private setupPagination(): void {
    const totalPages = Math.ceil(this.dataService.totalRecords() / this.pageSize())
    this.totalPages.set(totalPages)
  }

  private loadPageData(): void {
    this.dataService.getPaginatedData(this.currentPage(), this.pageSize()).subscribe({
      next: (data) => this.currentData.set(data),
      error: (err) => {
        this.errorMessage.set('Error al cargar la página de datos.')
        console.error('Error loading page:', err)
      }
    })
  }

  changePage(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages()) return
    this.currentPage.set(newPage)
    this.loadPageData()
  }

  changePageSize(newSize: number): void {
    this.pageSize.set(Number(newSize))
    this.currentPage.set(1)
    this.setupPagination()
    this.loadPageData()
  }

  refreshData(): void {
    this.errorMessage.set('')
    this.dataService.forceRefresh().subscribe({
      next: () => {
        this.currentPage.set(1)
        this.setupPagination()
        this.loadPageData()
      },
      error: (err) => {
        this.errorMessage.set('Error al actualizar los datos.')
        console.error('Error refreshing data:', err)
      }
    })
  }
}
